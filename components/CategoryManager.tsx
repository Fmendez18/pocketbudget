"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CATEGORIES, matchEmoji, parseAmount, suggestEmoji, type Category } from "@/lib/categories";

// emojiTouched: the user picked this emoji by hand, so renaming must not overwrite it.
type Draft = { name: string; emoji: string; budget: string; emojiTouched?: boolean };

const CATEGORY_COLUMNS = "id, name, emoji, budget, position";

function friendlyError(message: string, code?: string) {
  if (code === "23505") return "You already have a category with that name.";
  return message;
}

export default function CategoryManager({
  supabase,
  categories,
  onCategoriesChange,
  onDeleteCategory,
  onClose,
}: {
  supabase: SupabaseClient;
  categories: Category[];
  onCategoriesChange: (next: Category[]) => void;
  onDeleteCategory: (category: Category) => Promise<void>;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, { name: c.name, emoji: c.emoji, budget: String(c.budget) }]))
  );
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newEmojiTouched, setNewEmojiTouched] = useState(false);
  const [newBudget, setNewBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Until the user picks an emoji themselves, keep suggesting one from the name.
  const shownNewEmoji = newEmojiTouched ? newEmoji : newName.trim() ? suggestEmoji(newName) : "";

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  // Renaming re-suggests the emoji, falling back to the saved one when the name isn't recognised.
  function renameDraft(category: Category, name: string) {
    setDrafts((d) => {
      const current = d[category.id];
      const emoji = current.emojiTouched ? current.emoji : matchEmoji(name) ?? category.emoji;
      return { ...d, [category.id]: { ...current, name, emoji } };
    });
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const changed: { id: string; name: string; emoji: string; budget: number }[] = [];
    for (const c of categories) {
      const d = drafts[c.id];
      if (!d) continue;
      const name = d.name.trim();
      const emoji = d.emoji.trim() || suggestEmoji(name);
      const budget = parseAmount(d.budget);
      if (!name) return setError("Every category needs a name.");
      if (budget === null) return setError(`The budget for “${name}” must be a positive number.`);
      if (name !== c.name || emoji !== c.emoji || budget !== c.budget) changed.push({ id: c.id, name, emoji, budget });
    }
    if (changed.length === 0) return onClose();

    setBusy(true);
    const results = await Promise.all(
      changed.map(({ id, ...fields }) =>
        supabase.from("categories").update(fields).eq("id", id).select(CATEGORY_COLUMNS).single()
      )
    );
    setBusy(false);

    const updated = new Map(results.filter((r) => r.data).map((r) => [r.data!.id, r.data as Category]));
    onCategoriesChange(categories.map((c) => (updated.has(c.id) ? { ...c, ...updated.get(c.id), budget: Number(updated.get(c.id)!.budget) } : c)));

    const failed = results.find((r) => r.error);
    if (failed?.error) return setError(friendlyError(failed.error.message, failed.error.code));
    onClose();
  }

  async function handleAdd() {
    setError(null);
    const name = newName.trim();
    const budget = parseAmount(newBudget);
    if (!name) return setError("Give the new category a name, e.g. “Transport”.");
    if (budget === null) return setError("The budget must be a positive number.");
    if (categories.length >= MAX_CATEGORIES) return setError(`You can have up to ${MAX_CATEGORIES} categories.`);

    setBusy(true);
    const position = Math.max(-1, ...categories.map((c) => c.position)) + 1;
    const { data, error } = await supabase
      .from("categories")
      .insert({ name, emoji: shownNewEmoji.trim() || suggestEmoji(name), budget, position })
      .select(CATEGORY_COLUMNS)
      .single();
    setBusy(false);

    if (error) return setError(friendlyError(error.message, error.code));
    const created = { ...(data as Category), budget: Number(data.budget) };
    onCategoriesChange([...categories, created]);
    setDrafts((d) => ({ ...d, [created.id]: { name: created.name, emoji: created.emoji, budget: String(created.budget) } }));
    setNewName("");
    setNewEmoji("");
    setNewEmojiTouched(false);
    setNewBudget("");
  }

  async function handleDelete(category: Category) {
    setError(null);
    if (categories.length <= 1) return setError("You need at least one category.");
    setBusy(true);
    await onDeleteCategory(category);
    setBusy(false);
  }

  return (
    <form className="card manager" onSubmit={handleSave}>
      <h2>Your categories</h2>
      <p className="muted small">Rename them, change the emoji or the monthly budget, add new ones or remove the ones you don&apos;t need.</p>

      <ul className="manager-list">
        {categories.map((c) => {
          const d = drafts[c.id] ?? { name: c.name, emoji: c.emoji, budget: String(c.budget) };
          return (
            <li key={c.id} className="manager-row">
              <input
                className="emoji-input"
                aria-label={`Emoji for ${c.name}`}
                value={d.emoji}
                onChange={(e) => updateDraft(c.id, { emoji: e.target.value, emojiTouched: true })}
              />
              <input
                className="name-input"
                aria-label={`Name of ${c.name}`}
                maxLength={40}
                value={d.name}
                onChange={(e) => renameDraft(c, e.target.value)}
              />
              <div className="euro-input budget-input">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Monthly budget for ${c.name}`}
                  value={d.budget}
                  onChange={(e) => updateDraft(c.id, { budget: e.target.value })}
                />
                <span aria-hidden="true">€</span>
              </div>
              <button
                type="button"
                className="btn-icon"
                aria-label={`Delete category ${c.name}`}
                disabled={busy || categories.length <= 1}
                onClick={() => handleDelete(c)}
              >
                🗑
              </button>
            </li>
          );
        })}
      </ul>

      {categories.length < MAX_CATEGORIES && (
        <div className="manager-row new-row">
          <input
            className="emoji-input"
            aria-label="Emoji for the new category"
            placeholder="🙂"
            value={shownNewEmoji}
            onChange={(e) => {
              setNewEmojiTouched(true);
              setNewEmoji(e.target.value);
            }}
          />
          <input
            className="name-input"
            aria-label="Name of the new category"
            placeholder="New category, e.g. Transport"
            maxLength={40}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <div className="euro-input budget-input">
            <input
              type="text"
              inputMode="decimal"
              aria-label="Monthly budget for the new category"
              placeholder="0"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
            />
            <span aria-hidden="true">€</span>
          </div>
          <button type="button" className="btn btn-ghost add-cat-btn" disabled={busy} onClick={handleAdd}>
            + Add
          </button>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
