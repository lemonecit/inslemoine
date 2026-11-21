// Adresse publique du site. À définir via NEXT_PUBLIC_SITE_URL (Vercel : Settings > Environment Variables).
// La valeur de repli est un exemple à remplacer par le vrai nom de domaine.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.lemoine-accessibilite.fr"
).replace(/\/$/, "");

// Tant que l'adresse réelle n'est pas définie, la page reste en « noindex » : les moteurs ne
// doivent pas indexer un brouillon dont l'URL canonique pointerait vers un domaine qui n'est pas le nôtre.
export const SITE_URL_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE_NAME = "Institut Lemoine Accessibilité";

export const SITE_SLOGAN = "Pour un monde numérique sans barrières.";

export const SITE_TOPICS = [
  "Accessibilité numérique",
  "Inclusion numérique",
  "WCAG",
  "RGAA",
  "Logiciels open source",
];

export const SITE_DESCRIPTION =
  "Association française dédiée à l’inclusion numérique : audits d’accessibilité, solutions open-source et formations conformes aux normes WCAG et RGAA.";
