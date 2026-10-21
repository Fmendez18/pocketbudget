export type CategoryId = "food" | "going_out" | "hobbies";

export const CATEGORIES: { id: CategoryId; label: string; emoji: string; defaultBudget: number }[] = [
  { id: "food", label: "Food", emoji: "🍝", defaultBudget: 250 },
  { id: "going_out", label: "Going out", emoji: "🎉", defaultBudget: 150 },
  { id: "hobbies", label: "Hobbies & other", emoji: "🎸", defaultBudget: 100 },
];

export const DEFAULT_CATEGORY: CategoryId = "hobbies";

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const formatEur = (n: number) => eur.format(n);

// Accepts "3.50", "3,50" or "" (empty means 0).
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
