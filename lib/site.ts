// Adresse publique du site. Peut être remplacée via NEXT_PUBLIC_SITE_URL (par exemple pour un
// aperçu de test), sans « / » final.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://institut-lemoine.fr"
).replace(/\/$/, "");

// Adresse de contact : la boîte doit exister chez le fournisseur du nom de domaine.
export const CONTACT_EMAIL = "contact@institut-lemoine.fr";

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
