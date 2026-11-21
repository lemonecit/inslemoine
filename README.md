# Institut Lemoine Accessibilité

Site vitrine de l'Institut Lemoine Accessibilité, association loi 1901 dédiée à l'inclusion numérique.

## Objectifs d'accessibilité

- Conformité WCAG 2.2 niveau AA minimum, AAA visé (contrastes renforcés, navigation clavier complète).
- Lien d'évitement « Aller au contenu principal » en premier dans le DOM.
- HTML sémantique (`header`, `nav`, `main`, `section`, `footer`, hiérarchie h1–h3) ; ARIA uniquement en complément.
- Police Atkinson Hyperlegible, tailles en `rem` (compatibles avec le zoom texte du navigateur).
- Illustration du hero (`components/HeroArt.tsx`) : « Barrières → passage ». Un champ de traits verticaux (les barrières) est traversé par un passage : les traits proches s'inclinent dans le sens du flux et la voie centrale est dégagée ; dans cette voie, « sans barrières » est écrit en braille français (⠎⠁⠝⠎ ⠃⠁⠗⠗⠊⠮⠗⠑⠎). Deux compositions issues du même algorithme : large (ordinateur) et en hauteur (mobile ≤ 36 rem), où le dessin couvre tout le hero et s'estompe derrière le texte. Dessin généré par calcul dans le navigateur après l'hydratation (aucune image, aucun hasard, rien de plus dans le HTML), purement décoratif (`aria-hidden`), masqué en contraste renforcé et en couleurs forcées ; les points apparaissent un à un seulement si les animations ne sont pas réduites. Pour le modifier : la courbe `P`, la largeur de la voie `LANE`, la portée `REACH` et le texte `TEXT`.
- Menu « Accessibilité » : taille du texte, contraste (noir sur blanc / jaune sur noir), espacement, police Lexend, animations réduites. Réglages mémorisés dans `localStorage` (`lib/a11y-prefs.ts`).
- Navigation mobile : jusqu'à 70 rem de large, la navigation est repliée derrière un bouton « Menu » (motif « disclosure » : `aria-expanded`, Échap ferme et rend le focus au bouton, la liste se referme au choix d'un lien ou quand le focus la quitte). Sans JavaScript, la navigation reste visible (`components/SiteNav.tsx`). L'en-tête est collant seulement s'il occupe moins d'un quart de l'écran (`components/HeaderObserver.tsx`).
- Loupe au clavier (option) : chaque élément atteint avec Tab s'affiche en très grand ; les sections de texte proposent « Lire en grand », un mode lecture plein écran (`components/FocusAssist.tsx`). Il s'ouvre sur Entrée, jamais automatiquement (WCAG 3.2.1).
- Lecteur PDF accessible : « Ouvrir en lecture accessible » extrait le texte d'un PDF avec `pdf.js` (dans le navigateur) et le recompose en colonne unique (titres, paragraphes, listes) dans le même mode lecture, avec les réglages du menu Accessibilité (`components/PdfReader.tsx`, `lib/pdf-reflow.ts`). Le PDF original reste téléchargeable.
  - Limites : les PDF scannés (images) n'ont pas de texte et ne sont pas pris en charge sans OCR ; les tableaux, formules, colonnes multiples et images ne sont pas reconstitués. Les niveaux de titres sont déduits de la taille des caractères.
  - Pour ajouter un document : placer le PDF dans `public/documents/` et utiliser `<PdfReader src=… title=… description=… />`.
  - `public/pdf.worker.min.mjs` est copié depuis `pdfjs-dist` par `npm install` (script `postinstall`).
- Texte facile à lire (FALC) : chaque section a une version simplifiée dans le mode lecture, écrite dans `lib/falc.ts`. Les textes sont statiques ; à faire relire par des personnes concernées avant publication officielle.

## RGPD et confidentialité

État actuel : aucun cookie, aucun traceur, aucun service tiers (polices et lecteur PDF hébergés/exécutés localement). Le stockage local se limite à `ila-a11y` (réglages d'affichage choisis par la personne, effacé après 12 mois ou à la réinitialisation) et `ila-consent` (mémorise le clic sur « J'ai compris », 12 mois). Aucun consentement n'est juridiquement nécessaire.

- **Fenêtre d'information à la première visite** : la page est verrouillée (dialogue modal) jusqu'au clic sur « J'ai compris » (Échap vaut validation, pour ne jamais piéger une personne au clavier). Elle contient aussi des boutons de taille du texte et de contraste pour pouvoir la lire. Elle n'apparaît pas sur les pages d'information (`/confidentialite`, `/mentions-legales`, `/declaration-accessibilite`). Pour la désactiver : `FIRST_VISIT_NOTICE = false` dans `lib/consent.ts`.

- Pages : `/mentions-legales`, `/confidentialite` et `/declaration-accessibilite`, liées dans le pied de page. **Les champs `[À COMPLÉTER : …]` (surlignés en jaune) doivent être renseignés, et les textes validés par un juriste avant la mise en ligne.** La déclaration d'accessibilité indique « conformité non encore évaluée » : à mettre à jour après le test avec lecteurs d'écran (NVDA, JAWS, VoiceOver) ou un audit RGAA.
- Bannière de consentement prête (trois choix égaux) mais inactive tant que `lib/consent.ts` (`SERVICES`) est vide. Pour ajouter un service facultatif (mesure d'audience, vidéo intégrée…) :
  1. l'ajouter dans `SERVICES` (`id`, `label`, `description`) : la bannière « Non merci / Je choisis / OK pour moi » et le lien « Gérer mes choix sur les cookies » du pied de page s'activent, et la politique de confidentialité liste le service ;
  2. ne charger son script que dans `<ConsentGate service="id">…</ConsentGate>` (`components/ConsentGate.tsx`).
  - Refus redemandé après 6 mois, accord après 13 mois (recommandations CNIL) ; un nouveau service redemande le choix ; Échap vaut refus.
- Adresse publique : variable d'environnement `NEXT_PUBLIC_SITE_URL`. L'adresse `contact@lemoine-accessibilite.fr` de la section Contact est un exemple à remplacer.

## Référencement (SEO) et IA

- Tant que `NEXT_PUBLIC_SITE_URL` n'est pas définie, toutes les pages sont en `noindex` (brouillon : l'URL canonique pointerait vers un domaine qui n'est pas le nôtre). Une fois la variable définie, les pages sont indexables.
- Données structurées JSON-LD (`@graph` : `NGO` + `WebSite`), `sitemap.xml`, `robots.txt` (robots de recherche IA explicitement autorisés : OAI-SearchBot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended…), image Open Graph générée.
- `/llms.txt` : résumé du site pour les assistants IA (`app/llms.txt/route.ts`), construit à partir de `lib/site.ts`.
- Validation Google Search Console / Bing : variables de build facultatives `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` et `NEXT_PUBLIC_BING_SITE_VERIFICATION` (le code fourni par le service, sans les balises).

## Développement

```bash
npm install
npm run dev        # serveur de développement (http://localhost:3000)
npm run build      # export statique dans out/
npm run start      # prévisualise out/ en local
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run test:a11y  # axe-core + confidentialité sur 14 scénarios (après npm run build)
```

## Contrôles automatiques

`npm run test:a11y` (`scripts/a11y-check.mjs`) ouvre le site exporté dans Chrome et vérifie, pour 14 scénarios (ordinateur, mobile, 320 px avec réglages extrêmes, menus ouverts, fenêtre de première visite, mode lecture, lecteur PDF, pages juridiques, 404) :

- aucune violation axe-core (WCAG 2.2 AA et bonnes pratiques) ;
- les promesses de la politique de confidentialité : aucune requête vers un autre domaine, aucun cookie, aucune erreur de console ni réponse HTTP en erreur ;
- pas de défilement horizontal sur mobile (reflow).

Le workflow `.github/workflows/ci.yml` exécute lint, typecheck, build et ce contrôle à chaque `push` sur `main` et à chaque pull request. Pour ajouter une page ou un état à surveiller, ajouter un scénario dans `scenarios`. Chrome est requis (`CHROME_PATH` pour indiquer un autre emplacement).

## Déploiement (Cloudflare)

Le site est entièrement statique (`output: "export"`) : `npm run build` produit le dossier `out/`, sans serveur Node.

`wrangler.jsonc` (à la racine) déclare `out/` comme dossier d'assets statiques. **Ce fichier est indispensable** : sans lui, Cloudflare détecte Next.js et lance automatiquement `npx opennextjs-cloudflare build`, qui échoue avec un export statique. Son champ `name` doit être identique au nom du Worker dans le tableau de bord Cloudflare.

Réglages de Workers Builds (dépôt GitHub connecté) :

| Réglage | Valeur |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Variable de build `NODE_VERSION` | `22` (le fichier `.node-version` le précise aussi) |
| Variable de build `NEXT_PUBLIC_SITE_URL` | l'adresse publique, par exemple `https://www.exemple.fr` (sans `/` final) |

Vérification locale sans rien publier : `npx wrangler deploy --dry-run`.

`public/_headers` est lu par Cloudflare : en-têtes de sécurité, type MIME de `/opengraph-image` et du worker PDF, cache long pour `/_next/static/`.

**Réglages Cloudflare à vérifier pour rester cohérent avec la politique de confidentialité et l'accessibilité :**
- *Web Analytics* (balise automatique « beacon ») : désactivé, sinon un script tiers est ajouté et la politique de confidentialité devient inexacte.
- *Email Address Obfuscation* : désactivé (Scrape Shield), il remplace le lien `mailto:` par un script.
- *Rocket Loader* et *Auto Minify* : désactivés (ils modifient les scripts de la page).
- Après la mise en ligne, refaire le test Lighthouse sur l'adresse publique.
