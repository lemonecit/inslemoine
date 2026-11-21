// Klasser på första nivån i ISO 9999 (hjälpmedel för personer med funktionsnedsättning).
// Titlarna är en förenklad egen sammanfattning på svenska, inte den officiella texten.
// Kontrollera alltid mot den gällande standarden eller mot EASTIN innan något citeras.
export const ISO_CLASSES = [
  { code: "04", title: "Mätning, stöd, träning eller ersättning av kroppsfunktioner" },
  { code: "05", title: "Träning av färdigheter" },
  { code: "06", title: "Ortoser och proteser" },
  { code: "09", title: "Personlig vård och delaktighet i egenvård" },
  { code: "12", title: "Personlig förflyttning och transport" },
  { code: "15", title: "Hushållsaktiviteter" },
  { code: "18", title: "Inredning, möbler och stöd i inne- och utomhusmiljöer" },
  { code: "22", title: "Kommunikation och information" },
  { code: "24", title: "Hantering av föremål och apparater" },
  { code: "27", title: "Anpassning och mätning av miljön" },
  { code: "28", title: "Arbete och delaktighet i arbetslivet" },
  { code: "30", title: "Fritid och rekreation" },
] as const;

export const ISO_CLASS_CODES: readonly string[] = ISO_CLASSES.map((c) => c.code);

// Godtar « 22 03 18 », « 220318 », « 22.03.18 » och « 22 » och ger « 22 03 18 » respektive « 22 ».
// Ger null om koden inte har ISO 9999-form (2, 4 eller 6 siffror) eller en okänd klass.
export function normalizeIsoCode(input: string): string | null {
  const digits = input.replace(/[\s.\-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (![2, 4, 6].includes(digits.length)) return null;
  if (!ISO_CLASS_CODES.includes(digits.slice(0, 2))) return null;
  return (digits.match(/\d{2}/g) as string[]).join(" ");
}

export function isoClassOf(code: string): string | null {
  const normalized = normalizeIsoCode(code);
  return normalized ? normalized.slice(0, 2) : null;
}

export function isoClassTitle(classCode: string): string {
  return ISO_CLASSES.find((c) => c.code === classCode)?.title ?? "Okänd klass";
}
