"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CATEGORIES, matchEmoji, suggestEmoji, type Category } from "@/lib/categories";

// emojiTouched: the user picked this emoji by hand, so renaming must not overwrite it.
type Draft = { name: string; emoji: string; emojiTouched?: boolean };

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
  onSaved,
  onClose,
}: {
  supabase: SupabaseClient;
  categories: Category[];
  onCategoriesChange: (next: Category[]) => void;
  onDeleteCategory: (category: Category) => Promise<void>;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, { name: c.name, emoji: c.emoji }]))
  );
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newEmojiTouched, setNewEmojiTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

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
    setHint(null);

    const changed: { id: string; name: string; emoji: string }[] = [];
    for (const c of categories) {
      const d = drafts[c.id];
      if (!d) continue;
      const name = d.name.trim();
      const emoji = d.emoji.trim() || suggestEmoji(name);
      if (!name) return setError("Every category needs a name.");
      if (name !== c.name || emoji !== c.emoji) changed.push({ id: c.id, name, emoji });
    }
    // A filled-in new-category row is saved too, so it isn't lost if the user never clicked "+ Add".
    let newCategory: Omit<Category, "id"> | null = null;
    if (newName.trim()) {
      const fields = validateNewCategory();
      if (typeof fields === "string") return setError(fields);
      newCategory = fields;
    }
    if (changed.length === 0 && !newCategory) return onClose();

    setBusy(true);
    const [created, ...results] = await Promise.all([
      newCategory ? insertCategory(newCategory) : Promise.resolve(null),
      ...changed.map(({ id, ...fields }) =>
        supabase.from("categories").update(fields).eq("id", id).select(CATEGORY_COLUMNS).single()
      ),
    ]);
    setBusy(false);

    const updated = new Map(results.filter((r) => r.data).map((r) => [r.data!.id, r.data as Category]));
    const next = categories.map((c) =>
      updated.has(c.id) ? { ...c, name: updated.get(c.id)!.name, emoji: updated.get(c.id)!.emoji } : c
    );
    onCategoriesChange(created && "category" in created ? [...next, created.category] : next);

    const failed = results.find((r) => r.error);
    if (failed?.error) return setError(friendlyError(failed.error.message, failed.error.code));
    if (created && "error" in created) return setError(created.error);
    onSaved(created ? "Changes saved. Set the new category's amount in Edit budgets." : "Changes saved");
  }

  // Returns the fields to insert, or an error message.
  function validateNewCategory() {
    const name = newName.trim();
    if (!name) return "Give the new category a name, e.g. “Transport”.";
    if (categories.length >= MAX_CATEGORIES) return `You can have up to ${MAX_CATEGORIES} categories.`;
    const position = Math.max(-1, ...categories.map((c) => c.position)) + 1;
    // New categories start at 0 €; the amount is set in "Edit budgets".
    return { name, emoji: shownNewEmoji.trim() || suggestEmoji(name), budget: 0, position };
  }

  // Inserts the new category and clears the bottom row; on failure the row keeps its text.
  async function insertCategory(fields: Omit<Category, "id">): Promise<{ category: Category } | { error: string }> {
    const { data, error } = await supabase.from("categories").insert(fields).select(CATEGORY_COLUMNS).single();
    if (error) return { error: friendlyError(error.message, error.code) };
    const category = { ...(data as Category), budget: Number(data.budget) };
    setDrafts((d) => ({ ...d, [category.id]: { name: category.name, emoji: category.emoji } }));
    setNewName("");
    setNewEmoji("");
    setNewEmojiTouched(false);
    return { category };
  }

  async function handleAdd() {
    setError(null);
    setHint(null);
    const fields = validateNewCategory();
    if (typeof fields === "string") return setError(fields);

    setBusy(true);
    const result = await insertCategory(fields);
    setBusy(false);

    if ("error" in result) return setError(result.error);
    onCategoriesChange([...categories, result.category]);
    setHint(`“${result.category.name}” added with a 0 € budget. Set its amount in Edit budgets.`);
  }

  async function handleDelete(category: Category) {
    setError(null);
    if (categories.length <= 1) return setError("You need at least one category.");
    setBusy(true);
    await onDeleteCategory(category);
    setBusy(false);
  }

  return (
    <form id="category-manager" className="card manager" onSubmit={handleSave}>
      <h2>Manage categories</h2>
      <p className="muted small">Rename them, change the emoji, add new ones or remove the ones you don&apos;t need.</p>

      <ul className="manager-list">
        {categories.map((c) => {
          const d = drafts[c.id] ?? { name: c.name, emoji: c.emoji };
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
          <button type="button" className="btn btn-ghost add-cat-btn" disabled={busy} onClick={handleAdd}>
            + Add
          </button>
        </div>
      )}

      {hint && (
        <p className="hint" role="status">
          {hint}
        </p>
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
