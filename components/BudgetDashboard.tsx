"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CategoryManager from "@/components/CategoryManager";
import {
  DEFAULT_CATEGORIES,
  categoryHue,
  defaultCategoryId,
  formatEur,
  parseAmount,
  type Category,
} from "@/lib/categories";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category_id: string;
  created_at: string;
};

const CATEGORY_COLUMNS = "id, name, emoji, budget, position";
const EXPENSE_COLUMNS = "id, description, amount, category_id, created_at";

// Start of the current month in the user's own timezone, so "this month" matches their calendar.
function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default function BudgetDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);

  const formCategoryId = selected ?? defaultCategoryId(categories);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    const fetchCategories = () =>
      supabase.from("categories").select(CATEGORY_COLUMNS).order("position").order("created_at");

    async function load() {
      let categoryRes = await fetchCategories();
      if (!categoryRes.error && categoryRes.data.length === 0) {
        // First visit: create the default categories. ignoreDuplicates makes this safe if two tabs race.
        await supabase
          .from("categories")
          .upsert(
            DEFAULT_CATEGORIES.map((c, i) => ({ ...c, position: i })),
            { onConflict: "user_id,name", ignoreDuplicates: true }
          );
        categoryRes = await fetchCategories();
      }
      const expenseRes = await supabase
        .from("expenses")
        .select(EXPENSE_COLUMNS)
        .gte("created_at", startOfMonthIso())
        .order("created_at", { ascending: false });

      if (categoryRes.error || expenseRes.error) {
        setError((categoryRes.error ?? expenseRes.error)!.message);
      }
      if (categoryRes.data) {
        setCategories(categoryRes.data.map((c) => ({ ...c, budget: Number(c.budget) })) as Category[]);
      }
      if (expenseRes.data) {
        setExpenses(expenseRes.data.map((e) => ({ ...e, amount: Number(e.amount) })) as Expense[]);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const spentByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + e.amount);
    return totals;
  }, [expenses]);

  const visibleExpenses = selected ? expenses.filter((e) => e.category_id === selected) : expenses;

  async function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const text = description.trim();
    if (!text) {
      setError("Write a short description, e.g. “Mercadona”.");
      return;
    }
    const value = parseAmount(amount);
    if (value === null) {
      setError("The amount must be a positive number, e.g. 12.50.");
      return;
    }
    if (!formCategoryId) {
      setError("Create a category first.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({ description: text, amount: value, category_id: formCategoryId })
      .select(EXPENSE_COLUMNS)
      .single();
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setExpenses((prev) => [{ ...(data as Expense), amount: Number(data.amount) }, ...prev]);
    setDescription("");
    setAmount("0");
  }

  async function handleDeleteExpense(id: string) {
    const previous = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setExpenses(previous);
      setError(error.message);
    }
  }

  // Deleting a category also deletes its expenses (ON DELETE CASCADE), so say how many first.
  async function handleDeleteCategory(category: Category) {
    const { count } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("category_id", category.id);
    const n = count ?? 0;
    const warning = n > 0 ? `\n\nThis also deletes its ${n} expense${n === 1 ? "" : "s"}.` : "";
    if (!window.confirm(`Delete the category “${category.name}”?${warning}`)) return;

    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    setExpenses((prev) => prev.filter((e) => e.category_id !== category.id));
    if (selected === category.id) setSelected(null);
  }

  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedCategory = selected ? categoryById.get(selected) : undefined;

  return (
    <div className="container dashboard">
      <div className="dash-head">
        <div>
          <h1>Your budget</h1>
          <p className="muted">{monthName}</p>
        </div>
        {!managing && !loading && (
          <button type="button" className="btn btn-ghost" onClick={() => setManaging(true)}>
            ✏️ Edit categories
          </button>
        )}
      </div>

      {managing && (
        <CategoryManager
          supabase={supabase}
          categories={categories}
          onCategoriesChange={setCategories}
          onDeleteCategory={handleDeleteCategory}
          onClose={() => setManaging(false)}
        />
      )}

      <section className="cards" aria-label="Categories">
        {categories.map((c) => {
          const spent = spentByCategory.get(c.id) ?? 0;
          const left = c.budget - spent;
          const pct = c.budget > 0 ? Math.min(100, (spent / c.budget) * 100) : spent > 0 ? 100 : 0;
          const isSelected = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`card category-card ${isSelected ? "selected" : ""}`}
              style={{ "--hue": categoryHue(c.name) } as React.CSSProperties}
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : c.id)}
            >
              <span className="cat-watermark" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="cat-title">
                <span aria-hidden="true">{c.emoji}</span> {c.name}
              </span>
              <span className={`cat-left ${left < 0 ? "over" : ""}`}>
                {formatEur(left)} <span className="small">left</span>
              </span>
              <span
                className="bar"
                role="progressbar"
                aria-label={`${c.name} spent`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <span
                  className={`bar-fill ${left < 0 ? "over" : pct >= 80 ? "warn" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="cat-meta small">
                Spent {formatEur(spent)} of {formatEur(c.budget)}
              </span>
            </button>
          );
        })}
      </section>

      <form className="card add-form" onSubmit={handleAddExpense}>
        <h2>Add an expense</h2>
        <div className="add-grid">
          <label className="field grow">
            <span>Description</span>
            <input
              type="text"
              placeholder="e.g. Mercadona"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="core-input"
            />
          </label>
          <label className="field amount">
            <span>Amount</span>
            <div className="euro-input">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span aria-hidden="true">€</span>
            </div>
          </label>
          <label className="field category">
            <span>Category</span>
            <select
              value={formCategoryId ?? ""}
              disabled={loading}
              onChange={(e) => setSelected(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primary add-btn"
            disabled={saving || loading}
            data-testid="core-submit"
          >
            {saving ? "Saving…" : "Add expense"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>

      <section className="expenses">
        <div className="list-head">
          <h2>{selectedCategory ? `${selectedCategory.emoji} ${selectedCategory.name} expenses` : "All expenses this month"}</h2>
          {selected && (
            <button type="button" className="btn btn-link" onClick={() => setSelected(null)}>
              Show all
            </button>
          )}
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : visibleExpenses.length === 0 ? (
          <p className="muted empty">No expenses yet. Add your first one above.</p>
        ) : (
          <ul className="expense-list">
            {visibleExpenses.map((e) => {
              const cat = categoryById.get(e.category_id);
              return (
                <li key={e.id} className="expense" data-testid="core-item">
                  <span className="expense-emoji" aria-hidden="true">
                    {cat?.emoji ?? "💸"}
                  </span>
                  <div className="expense-main">
                    <span className="expense-desc">{e.description}</span>
                    <span className="muted small">
                      {cat?.name ?? "—"} ·{" "}
                      {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <span className="expense-amount">{formatEur(e.amount)}</span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Delete ${e.description}`}
                    onClick={() => handleDeleteExpense(e.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
