import { normalizeIsoCode } from "./iso9999";
import { ProductInputSchema, type ProductInput } from "./schema";

// Läser CSV (komma, semikolon eller tab som avgränsare, citattecken enligt RFC 4180).
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts: [string, number][] = [
    [",", firstLine.split(",").length],
    [";", firstLine.split(";").length],
    ["\t", firstLine.split("\t").length],
  ];
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function csvToRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])),
  );
}

const FIELD_ALIASES: Record<string, keyof ProductInput | "price"> = {
  name: "name",
  namn: "name",
  nom: "name",
  produkt: "name",
  product: "name",
  productname: "name",
  produktnamn: "name",
  isocode: "iso_code",
  iso: "iso_code",
  iso9999: "iso_code",
  isokod: "iso_code",
  code: "iso_code",
  kod: "iso_code",
  manufacturer: "manufacturer",
  tillverkare: "manufacturer",
  fabricant: "manufacturer",
  brand: "manufacturer",
  marque: "manufacturer",
  leverantor: "manufacturer",
  price: "price",
  pris: "price",
  prix: "price",
  priceeur: "price",
  pricemin: "price_min_eur",
  priceminur: "price_min_eur",
  pricemineur: "price_min_eur",
  minpris: "price_min_eur",
  prixmin: "price_min_eur",
  pricemax: "price_max_eur",
  pricemaxeur: "price_max_eur",
  maxpris: "price_max_eur",
  prixmax: "price_max_eur",
  pricenote: "price_note",
  prisnotering: "price_note",
  function: "function",
  funktion: "function",
  fonction: "function",
  description: "function",
  beskrivning: "function",
  targetgroup: "target_group",
  malgrupp: "target_group",
  publiccible: "target_group",
  limitations: "limitations",
  begransningar: "limitations",
  limites: "limitations",
  sourceurl: "source_url",
  url: "source_url",
  source: "source_url",
  lank: "source_url",
  lien: "source_url",
  notes: "notes",
  anteckningar: "notes",
};

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  let cleaned = value.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Sista skiljetecknet är decimaltecken, det andra är tusentalsavgränsare.
    const decimal = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    cleaned = cleaned.split(thousands).join("").replace(decimal, ".");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toLimitations(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/\||\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export type ImportResult = { rows: ProductInput[]; warnings: string[] };

// Gör om fria poster (från CSV eller JSON) till validerade produktrader.
export function recordsToProducts(records: unknown[]): ImportResult {
  const rows: ProductInput[] = [];
  const warnings: string[] = [];

  records.forEach((record, index) => {
    const label = `Rad ${index + 1}`;
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      warnings.push(`${label}: hoppades över (inte ett objekt).`);
      return;
    }

    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const field = FIELD_ALIASES[normalizeKey(key)];
      if (!field) continue;
      if (field === "price") {
        const n = parsePrice(value);
        if (n !== null) {
          mapped.price_min_eur ??= n;
          mapped.price_max_eur ??= n;
        }
      } else if (field === "price_min_eur" || field === "price_max_eur") {
        mapped[field] = parsePrice(value);
      } else if (field === "limitations") {
        mapped.limitations = toLimitations(value);
      } else {
        mapped[field] = typeof value === "string" ? value : value == null ? "" : String(value);
      }
    }

    if (typeof mapped.iso_code === "string" && mapped.iso_code.trim() !== "") {
      const normalized = normalizeIsoCode(mapped.iso_code);
      if (normalized) {
        mapped.iso_code = normalized;
      } else {
        warnings.push(`${label}: ISO-koden "${mapped.iso_code}" känns inte igen och lämnades tom.`);
        mapped.iso_code = "";
      }
    }

    const parsed = ProductInputSchema.safeParse(mapped);
    if (parsed.success) rows.push(parsed.data);
    else warnings.push(`${label}: hoppades över (${parsed.error.issues[0]?.message ?? "ogiltig"}).`);
  });

  return { rows, warnings };
}

export function importCsv(text: string): ImportResult {
  return recordsToProducts(csvToRecords(text));
}

export function importJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { rows: [], warnings: ["Filen är inte giltig JSON."] };
  }
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { products?: unknown })?.products)
      ? (data as { products: unknown[] }).products
      : null;
  if (!list) {
    return { rows: [], warnings: ["JSON måste vara en lista eller ha fältet « products »."] };
  }
  return recordsToProducts(list);
}
