export type Category = {
  id: string;
  name: string;
  emoji: string;
  budget: number;
  position: number;
};

// Created for a user on their first visit to /app, so the app works with zero setup.
export const DEFAULT_CATEGORIES = [
  { name: "Food", emoji: "🍝", budget: 250 },
  { name: "Going out", emoji: "🎉", budget: 150 },
  { name: "Hobbies & other", emoji: "🎸", budget: 100 },
];

// Where an expense goes when no category is selected. If the user renamed or deleted it,
// the first remaining category is used instead, so a description alone can always be saved.
export const FALLBACK_CATEGORY_NAME = "Hobbies & other";

export const MAX_CATEGORIES = 12;

export function defaultCategoryId(categories: Category[]): string | null {
  const preferred = categories.find((c) => c.name === FALLBACK_CATEGORY_NAME);
  return preferred?.id ?? categories[0]?.id ?? null;
}

// Keyword -> emoji + colour hue. Accents are ignored ("café" == "cafe"). Keywords of 4+ letters
// match the start of a word ("hobb" -> "Hobbies"); shorter ones must be the whole word or its
// plural, so "bar" matches "Bars" but not "Barcelona".
const THEMES: { keywords: string[]; emoji: string; hue: number }[] = [
  { keywords: ["groceri", "supermarket", "supermercado", "mercadona", "carrefour", "lidl", "compra"], emoji: "🛒", hue: 140 },
  { keywords: ["food", "comida", "eat", "lunch", "dinner", "almuerzo", "cena", "restaurant", "takeaway", "delivery"], emoji: "🍝", hue: 25 },
  { keywords: ["coffee", "cafe", "starbucks", "brunch"], emoji: "☕", hue: 30 },
  { keywords: ["going out", "salir", "party", "parties", "fiesta", "bar", "drink", "copas", "club", "nightlife"], emoji: "🎉", hue: 285 },
  { keywords: ["transport", "metro", "bus", "uber", "cabify", "taxi", "train", "tren", "renfe", "bike", "bici"], emoji: "🚇", hue: 210 },
  { keywords: ["rent", "alquiler", "housing", "piso", "home", "casa"], emoji: "🏠", hue: 35 },
  { keywords: ["bill", "factura", "utilit", "electric", "luz", "agua", "water"], emoji: "💡", hue: 52 },
  { keywords: ["phone", "movil", "mobile", "internet", "telefono", "wifi"], emoji: "📱", hue: 220 },
  { keywords: ["gym", "sport", "deporte", "fitness", "padel", "tennis", "football", "futbol", "yoga"], emoji: "🏋️", hue: 5 },
  { keywords: ["travel", "trip", "viaje", "vacation", "holiday", "flight", "vuelo"], emoji: "✈️", hue: 195 },
  { keywords: ["clothes", "ropa", "fashion", "shopping", "zara", "shoes"], emoji: "👕", hue: 330 },
  { keywords: ["book", "libro", "study", "studies", "uni", "school", "course", "curso", "material"], emoji: "📚", hue: 45 },
  { keywords: ["subscription", "suscrip", "netflix", "spotify", "hbo", "disney", "streaming"], emoji: "📺", hue: 262 },
  { keywords: ["music", "musica", "concert", "concierto", "guitar", "festival"], emoji: "🎸", hue: 300 },
  { keywords: ["game", "gaming", "videojuego", "juego", "playstation", "xbox", "nintendo"], emoji: "🎮", hue: 250 },
  { keywords: ["cinema", "cine", "movie", "pelicula", "film", "theatre", "teatro"], emoji: "🎬", hue: 350 },
  { keywords: ["health", "salud", "pharmacy", "farmacia", "doctor", "medic", "dentist"], emoji: "💊", hue: 165 },
  { keywords: ["gift", "regalo", "present", "birthday", "cumple"], emoji: "🎁", hue: 345 },
  { keywords: ["pet", "mascota", "dog", "perro", "cat", "gato"], emoji: "🐶", hue: 40 },
  { keywords: ["beauty", "belleza", "hair", "pelu", "cosmetic", "makeup"], emoji: "💅", hue: 320 },
  { keywords: ["saving", "ahorro", "piggy"], emoji: "🐷", hue: 100 },
  { keywords: ["hobb", "art", "craft", "paint", "photo", "other", "otros", "misc"], emoji: "🎨", hue: 270 },
];

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function wordMatches(word: string, keyword: string) {
  return word === keyword || word === keyword + "s" || (keyword.length >= 4 && word.startsWith(keyword));
}

function findTheme(name: string) {
  const text = normalize(name);
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  return THEMES.find((t) =>
    t.keywords.some((k) => (k.includes(" ") ? text.includes(k) : words.some((w) => wordMatches(w, k))))
  );
}

// The emoji for a recognised name, or undefined if no keyword matches.
export function matchEmoji(name: string): string | undefined {
  return findTheme(name)?.emoji;
}

export function suggestEmoji(name: string): string {
  return matchEmoji(name) ?? "💸";
}

// Unknown names still get a stable colour: hash the name onto the colour wheel.
export function categoryHue(name: string): number {
  const theme = findTheme(name);
  if (theme) return theme.hue;
  let h = 0;
  for (const ch of normalize(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
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
