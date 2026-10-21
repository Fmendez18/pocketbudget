"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  categoryLabel,
  formatEur,
  parseAmount,
  type CategoryId,
} from "@/lib/categories";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: CategoryId;
  created_at: string;
};

type Budgets = Record<CategoryId, number>;

const DEFAULT_BUDGETS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultBudget])) as Budgets;

// Start of the current month in the user's own timezone, so "this month" matches their calendar.
function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default function BudgetDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [budgets, setBudgets] = useState<Budgets>(DEFAULT_BUDGETS);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [saving, setSaving] = useState(false);

  const [editingBudgets, setEditingBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<Record<CategoryId, string>>({ food: "", going_out: "", hobbies: "" });
  const [savingBudgets, setSavingBudgets] = useState(false);

  const formCategory: CategoryId = selected ?? DEFAULT_CATEGORY;

  useEffect(() => {
    async function load() {
      const [budgetRes, expenseRes] = await Promise.all([
        supabase.from("budgets").select("category, amount"),
        supabase
          .from("expenses")
          .select("id, description, amount, category, created_at")
          .gte("created_at", startOfMonthIso())
          .order("created_at", { ascending: false }),
      ]);
      if (budgetRes.error || expenseRes.error) {
        setError((budgetRes.error ?? expenseRes.error)!.message);
      }
      if (budgetRes.data) {
        const next = { ...DEFAULT_BUDGETS };
        for (const row of budgetRes.data) next[row.category as CategoryId] = Number(row.amount);
        setBudgets(next);
      }
      if (expenseRes.data) {
        setExpenses(expenseRes.data.map((e) => ({ ...e, amount: Number(e.amount) })) as Expense[]);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const spentByCategory = useMemo(() => {
    const totals: Budgets = { food: 0, going_out: 0, hobbies: 0 };
    for (const e of expenses) totals[e.category] += e.amount;
    return totals;
  }, [expenses]);

  const visibleExpenses = selected ? expenses.filter((e) => e.category === selected) : expenses;

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

    setSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({ description: text, amount: value, category: formCategory })
      .select("id, description, amount, category, created_at")
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

  async function handleDelete(id: string) {
    const previous = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setExpenses(previous);
      setError(error.message);
    }
  }

  function startEditingBudgets() {
    setBudgetDraft({
      food: String(budgets.food),
      going_out: String(budgets.going_out),
      hobbies: String(budgets.hobbies),
    });
    setEditingBudgets(true);
  }

  async function handleSaveBudgets(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = {} as Budgets;
    for (const c of CATEGORIES) {
      const v = parseAmount(budgetDraft[c.id]);
      if (v === null) {
        setError(`Budget for ${c.label} must be a positive number.`);
        return;
      }
      parsed[c.id] = v;
    }

    setSavingBudgets(true);
    const { error } = await supabase.from("budgets").upsert(
      CATEGORIES.map((c) => ({ category: c.id, amount: parsed[c.id], updated_at: new Date().toISOString() })),
      { onConflict: "user_id,category" }
    );
    setSavingBudgets(false);

    if (error) {
      setError(error.message);
      return;
    }
    setBudgets(parsed);
    setEditingBudgets(false);
  }

  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="container dashboard">
      <div className="dash-head">
        <div>
          <h1>Your budget</h1>
          <p className="muted">{monthName}</p>
        </div>
        {!editingBudgets && (
          <button type="button" className="btn btn-ghost" onClick={startEditingBudgets}>
            ✏️ Edit budgets
          </button>
        )}
      </div>

      {editingBudgets && (
        <form className="card budget-editor" onSubmit={handleSaveBudgets}>
          <h2>Monthly budgets</h2>
          <div className="budget-fields">
            {CATEGORIES.map((c) => (
              <label key={c.id} className="field">
                <span>
                  {c.emoji} {c.label}
                </span>
                <div className="euro-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={budgetDraft[c.id]}
                    onChange={(e) => setBudgetDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                  />
                  <span aria-hidden="true">€</span>
                </div>
              </label>
            ))}
          </div>
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setEditingBudgets(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingBudgets}>
              {savingBudgets ? "Saving…" : "Save budgets"}
            </button>
          </div>
        </form>
      )}

      <section className="cards" aria-label="Categories">
        {CATEGORIES.map((c) => {
          const budget = budgets[c.id];
          const spent = spentByCategory[c.id];
          const left = budget - spent;
          const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
          const isSelected = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`card category-card ${isSelected ? "selected" : ""}`}
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : c.id)}
            >
              <div className="cat-title">
                <span>
                  {c.emoji} {c.label}
                </span>
                <span className="muted small">of {formatEur(budget)}</span>
              </div>
              <div className={`cat-left ${left < 0 ? "over" : ""}`}>
                {formatEur(left)} <span className="small">left</span>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-label={`${c.label} spent`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div
                  className={`bar-fill ${left < 0 ? "over" : pct >= 80 ? "warn" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="muted small">Spent {formatEur(spent)} this month</div>
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
            <select value={formCategory} onChange={(e) => setSelected(e.target.value as CategoryId)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary add-btn" disabled={saving} data-testid="core-submit">
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
          <h2>{selected ? `${categoryLabel(selected)} expenses` : "All expenses this month"}</h2>
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
            {visibleExpenses.map((e) => (
              <li key={e.id} className="expense" data-testid="core-item">
                <div className="expense-main">
                  <span className="expense-desc">{e.description}</span>
                  <span className="muted small">
                    {categoryLabel(e.category)} ·{" "}
                    {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <span className="expense-amount">{formatEur(e.amount)}</span>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Delete ${e.description}`}
                  onClick={() => handleDelete(e.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
