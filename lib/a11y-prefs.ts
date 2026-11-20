export type Prefs = {
  textSize: "default" | "large" | "xlarge";
  contrast: "default" | "high" | "dark";
  spacing: "default" | "wide";
  font: "default" | "lexend";
  motion: "default" | "reduced";
  magnifier: "default" | "on";
};

export const STORAGE_KEY = "ila-a11y";

export const DEFAULT_PREFS: Prefs = {
  textSize: "default",
  contrast: "default",
  spacing: "default",
  font: "default",
  motion: "default",
  magnifier: "default",
};

const ALLOWED: { [K in keyof Prefs]: readonly string[] } = {
  textSize: ["default", "large", "xlarge"],
  contrast: ["default", "high", "dark"],
  spacing: ["default", "wide"],
  font: ["default", "lexend"],
  motion: ["default", "reduced"],
  magnifier: ["default", "on"],
};

const ATTRIBUTES: { [K in keyof Prefs]: string } = {
  textSize: "data-text-size",
  contrast: "data-contrast",
  spacing: "data-spacing",
  font: "data-font",
  motion: "data-motion",
  magnifier: "data-magnifier",
};

// Les réglages sont conservés 12 mois au plus sur l'appareil, puis effacés.
export const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

// Exécuté avant la première peinture pour éviter tout flash de style.
export const INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  STORAGE_KEY,
)};var s=JSON.parse(localStorage.getItem(k)||"{}");if(s&&s.at&&Date.now()-s.at>${MAX_AGE_MS}){localStorage.removeItem(k);return}var m=${JSON.stringify(
  ATTRIBUTES,
)};var d=document.documentElement;for(var n in m){if(s&&s[n]&&s[n]!=="default"){d.setAttribute(m[n],String(s[n]))}}}catch(e){}})()`;

export function parsePrefs(raw: string): Prefs {
  const next: Prefs = { ...DEFAULT_PREFS };
  try {
    const data: unknown = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const { at } = data as { at?: unknown };
      if (typeof at === "number" && Date.now() - at > MAX_AGE_MS) return next;
      for (const key of Object.keys(ALLOWED) as (keyof Prefs)[]) {
        const value = (data as Record<string, unknown>)[key];
        if (typeof value === "string" && ALLOWED[key].includes(value)) {
          (next[key] as string) = value;
        }
      }
    }
  } catch {
    // Valeur corrompue : on retombe sur les réglages par défaut.
  }
  return next;
}

function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  for (const key of Object.keys(ATTRIBUTES) as (keyof Prefs)[]) {
    if (prefs[key] === "default") {
      root.removeAttribute(ATTRIBUTES[key]);
    } else {
      root.setAttribute(ATTRIBUTES[key], prefs[key]);
    }
  }
}

const CHANGE_EVENT = "ila-a11y-change";
let memoryRaw = "";

export function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return memoryRaw;
  }
}

export function getServerSnapshot(): string {
  return "";
}

export function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function save(prefs: Prefs) {
  // Si tout est par défaut, on n'écrit rien : plus aucune donnée n'est conservée.
  const isDefault = (Object.keys(prefs) as (keyof Prefs)[]).every(
    (key) => prefs[key] === "default",
  );
  const raw = isDefault ? "" : JSON.stringify({ ...prefs, at: Date.now() });
  memoryRaw = raw;
  try {
    if (raw) localStorage.setItem(STORAGE_KEY, raw);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : le réglage vaut pour la page.
  }
  applyPrefs(prefs);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setPref(key: keyof Prefs, value: string) {
  save(parsePrefs(JSON.stringify({ ...parsePrefs(getSnapshot()), [key]: value })));
}

export function resetPrefs() {
  save({ ...DEFAULT_PREFS });
}
