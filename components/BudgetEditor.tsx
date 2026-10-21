"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAmount, type Category } from "@/lib/categories";

const CATEGORY_COLUMNS = "id, name, emoji, budget, position";

export default function BudgetEditor({
  supabase,
  categories,
  onCategoriesChange,
  onSaved,
  onClose,
}: {
  supabase: SupabaseClient;
  categories: Category[];
  onCategoriesChange: (next: Category[]) => void;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, String(c.budget)]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const changed: { id: string; budget: number }[] = [];
    for (const c of categories) {
      const budget = parseAmount(drafts[c.id] ?? String(c.budget));
      if (budget === null) return setError(`The budget for “${c.name}” must be a positive number.`);
      if (budget !== c.budget) changed.push({ id: c.id, budget });
    }
    if (changed.length === 0) return onClose();

    setBusy(true);
    const results = await Promise.all(
      changed.map(({ id, budget }) =>
        supabase.from("categories").update({ budget }).eq("id", id).select(CATEGORY_COLUMNS).single()
      )
    );
    setBusy(false);

    const updated = new Map(results.filter((r) => r.data).map((r) => [r.data!.id, Number(r.data!.budget)]));
    onCategoriesChange(categories.map((c) => (updated.has(c.id) ? { ...c, budget: updated.get(c.id)! } : c)));

    const failed = results.find((r) => r.error);
    if (failed?.error) return setError(failed.error.message);
    onSaved("Budgets saved");
  }

  return (
    <form id="budget-editor" className="card manager" onSubmit={handleSave}>
      <h2>Monthly budgets</h2>
      <p className="muted small">How much you want to spend on each category this month.</p>

      <ul className="manager-list">
        {categories.map((c) => (
          <li key={c.id} className="budget-row">
            <label htmlFor={`budget-${c.id}`} className="budget-label">
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </label>
            <div className="euro-input">
              <input
                id={`budget-${c.id}`}
                type="text"
                inputMode="decimal"
                value={drafts[c.id] ?? ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              />
              <span aria-hidden="true">€</span>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save budgets"}
        </button>
      </div>
    </form>
  );
}
