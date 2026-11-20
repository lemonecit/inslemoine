# Institut Lemoine Accessibilité

Site vitrine de l'Institut Lemoine Accessibilité, association loi 1901 dédiée à l'inclusion numérique.

## Objectifs d'accessibilité

- Conformité WCAG 2.2 niveau AA minimum, AAA visé (contrastes renforcés, navigation clavier complète).
- Lien d'évitement « Aller au contenu principal » en premier dans le DOM.
- HTML sémantique (`header`, `nav`, `main`, `section`, `footer`, hiérarchie h1–h3) ; ARIA uniquement en complément.
- Police Atkinson Hyperlegible, tailles en `rem` (compatibles avec le zoom texte du navigateur).
- Menu « Accessibilité » : taille du texte, contraste (noir sur blanc / jaune sur noir), espacement, police Lexend, animations réduites. Réglages mémorisés dans `localStorage` (`lib/a11y-prefs.ts`).
- Loupe au clavier (option) : chaque élément atteint avec Tab s'affiche en très grand ; les sections de texte proposent « Lire en grand », un mode lecture plein écran (`components/FocusAssist.tsx`). Il s'ouvre sur Entrée, jamais automatiquement (WCAG 3.2.1).
- Lecteur PDF accessible : « Ouvrir en lecture accessible » extrait le texte d'un PDF avec `pdf.js` (dans le navigateur) et le recompose en colonne unique (titres, paragraphes, listes) dans le même mode lecture, avec les réglages du menu Accessibilité (`components/PdfReader.tsx`, `lib/pdf-reflow.ts`). Le PDF original reste téléchargeable.
  - Limites : les PDF scannés (images) n'ont pas de texte et ne sont pas pris en charge sans OCR ; les tableaux, formules, colonnes multiples et images ne sont pas reconstitués. Les niveaux de titres sont déduits de la taille des caractères.
  - Pour ajouter un document : placer le PDF dans `public/documents/` et utiliser `<PdfReader src=… title=… description=… />`.
  - `public/pdf.worker.min.mjs` est copié depuis `pdfjs-dist` par `npm install` (script `postinstall`).
- Texte facile à lire (FALC) : chaque section a une version simplifiée dans le mode lecture, écrite dans `lib/falc.ts`. Les textes sont statiques ; à faire relire par des personnes concernées avant publication officielle.

## RGPD et confidentialité

État actuel : aucun cookie, aucun traceur, aucun service tiers (polices et lecteur PDF hébergés/exécutés localement). Le seul stockage est `ila-a11y` (réglages d'affichage choisis par la personne, effacé après 12 mois ou à la réinitialisation). Aucun consentement n'est donc nécessaire et aucune bannière n'est affichée.

- Pages : `/mentions-legales`, `/confidentialite` et `/declaration-accessibilite`, liées dans le pied de page. **Les champs `[À COMPLÉTER : …]` (surlignés en jaune) doivent être renseignés, et les textes validés par un juriste avant la mise en ligne.** La déclaration d'accessibilité indique « conformité non encore évaluée » : à mettre à jour après le test avec lecteurs d'écran (NVDA, JAWS, VoiceOver) ou un audit RGAA.
- Bannière de consentement prête mais inactive : `lib/consent.ts` (`SERVICES`) est vide. Pour ajouter un service facultatif (mesure d'audience, vidéo intégrée…) :
  1. l'ajouter dans `SERVICES` (`id`, `label`, `description`) : la bannière « Non merci / Je choisis / OK pour moi » et le lien « Gérer mes choix sur les cookies » du pied de page s'activent, et la politique de confidentialité liste le service ;
  2. ne charger son script que dans `<ConsentGate service="id">…</ConsentGate>` (`components/ConsentGate.tsx`).
  - Refus redemandé après 6 mois, accord après 13 mois (recommandations CNIL) ; un nouveau service redemande le choix ; Échap vaut refus.
- Adresse publique : variable d'environnement `NEXT_PUBLIC_SITE_URL` (sinon valeur de repli dans `lib/site.ts`, à remplacer par le vrai domaine). L'adresse `contact@lemoine-accessibilite.fr` de la section Contact est un exemple à remplacer.

## Développement

```bash
npm install
npm run dev     # serveur de développement (http://localhost:3000)
npm run build   # build de production
npm run start   # serveur de production
npm run lint    # ESLint
```

## Déploiement

Projet Next.js (App Router) prêt pour un hébergement sur Vercel.
