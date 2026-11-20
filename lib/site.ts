// Adresse publique du site. À définir via NEXT_PUBLIC_SITE_URL (Vercel : Settings > Environment Variables).
// La valeur de repli est un exemple à remplacer par le vrai nom de domaine.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.lemoine-accessibilite.fr"
).replace(/\/$/, "");

export const SITE_NAME = "Institut Lemoine Accessibilité";

export const SITE_DESCRIPTION =
  "Association française dédiée à l’inclusion numérique : audits d’accessibilité, solutions open-source et formations conformes aux normes WCAG et RGAA.";
