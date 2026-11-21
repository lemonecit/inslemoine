// Gestion du consentement (RGPD / ePrivacy).
//
// Aujourd'hui le site ne dépose aucun traceur soumis au consentement : SERVICES est vide
// et la bannière n'est jamais affichée. Pour ajouter un service optionnel (mesure d'audience,
// vidéo intégrée…), ajoutez-le ci-dessous, puis chargez son script uniquement dans
// <ConsentGate service="id">…</ConsentGate> ou après hasConsent("id").
//
// Exemple :
//   { id: "audience", label: "Mesure d’audience", description: "Statistiques de visite anonymes." }
export type Service = { id: string; label: string; description: string };

export const SERVICES: Service[] = [];

// Fenêtre d'information affichée à la première visite : la page reste verrouillée tant qu'elle
// n'est pas validée. Sans service facultatif elle n'a qu'un bouton (« J'ai compris »).
// Mettre à false pour ne plus l'afficher tant que SERVICES est vide.
export const FIRST_VISIT_NOTICE = true;

export const CONSENT_KEY = "ila-consent";

// Recommandations CNIL : un refus est redemandé après 6 mois, un accord après 13 mois au plus.
// La simple information (aucun service) est redemandée après 12 mois.
const REFUSAL_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const ACCEPTANCE_MS = 13 * 30 * 24 * 60 * 60 * 1000;
const NOTICE_MS = 365 * 24 * 60 * 60 * 1000;

export type Choices = Record<string, boolean>;
export type Consent = { decided: boolean; choices: Choices };

const CHANGE_EVENT = "ila-consent-change";
export const OPEN_EVENT = "ila-consent-open";

// Valeur renvoyée côté serveur : permet de ne rien afficher avant l'hydratation.
export const SERVER_SNAPSHOT = "__server__";

export function parseConsent(raw: string): Consent {
  const none: Consent = { decided: false, choices: {} };
  if (!raw || raw === SERVER_SNAPSHOT) return none;
  try {
    const data = JSON.parse(raw) as { at?: unknown; choices?: unknown };
    if (typeof data.at !== "number" || !data.choices || typeof data.choices !== "object") {
      return none;
    }
    const choices: Choices = {};
    for (const service of SERVICES) {
      const value = (data.choices as Record<string, unknown>)[service.id];
      if (typeof value !== "boolean") return none; // nouveau service : on redemande
      choices[service.id] = value;
    }
    const maxAge =
      SERVICES.length === 0
        ? NOTICE_MS
        : Object.values(choices).some(Boolean)
          ? ACCEPTANCE_MS
          : REFUSAL_MS;
    if (Date.now() - data.at > maxAge) return none;
    return { decided: true, choices };
  } catch {
    return none;
  }
}

let memoryRaw = "";

export function getSnapshot(): string {
  try {
    return localStorage.getItem(CONSENT_KEY) ?? "";
  } catch {
    return memoryRaw;
  }
}

export function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveChoices(choices: Choices) {
  const raw = JSON.stringify({ at: Date.now(), choices });
  memoryRaw = raw;
  try {
    localStorage.setItem(CONSENT_KEY, raw);
  } catch {
    // Stockage indisponible : le choix vaut jusqu'au rechargement de la page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setAll(value: boolean) {
  saveChoices(Object.fromEntries(SERVICES.map((service) => [service.id, value])));
}

export function openPreferences() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
