# Institut Lemoine Accessibilité

Site vitrine de l'Institut Lemoine Accessibilité, association loi 1901 dédiée à l'inclusion numérique.

## Objectifs d'accessibilité

- Conformité WCAG 2.2 niveau AA minimum, AAA visé (contrastes renforcés, navigation clavier complète).
- Lien d'évitement « Aller au contenu principal » en premier dans le DOM.
- HTML sémantique (`header`, `nav`, `main`, `section`, `footer`, hiérarchie h1–h3) ; ARIA uniquement en complément.
- Police Atkinson Hyperlegible, tailles en `rem` (compatibles avec le zoom texte du navigateur).
- Logo (`components/BrandMark.tsx`, `app/icon.svg`) : les lettres « I » et « L » en braille. Le logo du site (en-tête et pied de page) est un lien vers l'accueil (`components/BrandLink.tsx`) : déjà sur l'accueil, il remonte en haut de page et place le focus sur le titre principal.
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
- Adresse publique : `https://institut-lemoine.fr` (par défaut dans `lib/site.ts`, remplaçable via la variable de build `NEXT_PUBLIC_SITE_URL`). L'adresse de contact `contact@institut-lemoine.fr` (`CONTACT_EMAIL`, `lib/site.ts`) doit exister chez le fournisseur du nom de domaine.

## Référencement (SEO) et IA

- Les pages sont indexables ; l'URL canonique, le sitemap, le JSON-LD et `llms.txt` utilisent l'adresse publique ci-dessus.
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
npm run test:unit  # tests unitaires du Worker (Cloudflare Access, import, scores)
npm run cf:dev     # Worker local complet (site + /admin + D1 locale) sur http://127.0.0.1:8787
```

## Outil d'administration (/admin/prototypes)

Vue interne, jamais publique, pour l'analyse de produits d'aide technique (ISO 9999 / EASTIN) et la génération d'idées de prototypes par une IA : fiche produit, import, analyse (goulots d'étranglement, proposition, faisabilité et coûts, utilité sociale et potentiel de subvention, SWOT, matrice de Pugh), suivi (Brouillon, Prioritaire, En développement, Archivé), notes, export Markdown et PDF (impression). L'interface est en suédois.

**Architecture.** Le site public reste statique. Le Worker (`worker/index.ts`) ne s'exécute que pour `/admin/*` et `/api/*` (`assets.run_worker_first` dans `wrangler.jsonc`) ; tout le reste est servi directement par les assets. Données dans **Cloudflare D1** (`migrations/`, tables `existing_products`, `prototype_ideas`, `idea_products`). Code partagé (schémas zod, import CSV/JSON, scores de Pugh, export Markdown, classes ISO) dans `lib/admin/`, interface dans `components/admin/`.

**Sécurité (défense en profondeur).**
1. **Cloudflare Access** devant `/admin*` et `/api/*` : le trafic non autorisé est bloqué avant d'atteindre le Worker.
2. **Le Worker vérifie lui-même** le jeton Access (`Cf-Access-Jwt-Assertion` : signature RS256, émetteur, `aud`, expiration, adresse e-mail dans `ADMIN_EMAILS`) et **refuse tout par défaut** (404 identique à une page inexistante). Une configuration incomplète verrouille l'outil. L'adresse `workers.dev` est donc protégée aussi.
3. Les appels modifiants doivent provenir de la même origine (protection CSRF). Toutes les réponses `/admin` et `/api` portent `X-Robots-Tag: noindex, nofollow, noarchive` et `Cache-Control: no-store` ; la page porte aussi `<meta name="robots" content="noindex">`. `/admin` n'apparaît ni dans `sitemap.xml` ni dans `robots.txt` (pour ne pas annoncer le chemin).
4. Le contournement local (`ALLOW_LOCAL_DEV=1`, fichier `.dev.vars` ignoré par Git) ne fonctionne que sur `localhost` / `127.0.0.1`.

**Mise en service (une seule fois).**
1. Base D1 : `npx wrangler d1 create inslemoine-admin`, copier le `database_id` dans `wrangler.jsonc` (`d1_databases`), puis `npx wrangler d1 migrations apply DB --remote`. Pour appliquer les migrations à chaque déploiement : commande de déploiement `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`.
2. Cloudflare Zero Trust, *Access > Applications > Add > Self-hosted* : domaine `institut-lemoine.fr`, chemins `/admin*` et `/api/*` ; politique *Allow* pour votre adresse e-mail (code à usage unique par e-mail ou connexion Google). Relever l'**Application Audience (AUD) Tag** et le nom d'équipe (`xxx.cloudflareaccess.com`).
3. Dans `wrangler.jsonc` (`vars`) : `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` (liste séparée par des virgules).
4. IA : `LLM_PROVIDER` (`anthropic` ou `openai`, ce dernier pour toute API compatible OpenAI avec `LLM_BASE_URL`), `LLM_MODEL` (nom exact du modèle choisi) dans `vars`, et la clé en secret : `npx wrangler secret put LLM_API_KEY`. Ne jamais mettre la clé dans le dépôt.

**Données et droit.** Aucune collecte automatique : l'outil ne contacte jamais EASTIN ni une autre base. Chercher sur le site, copier le texte (ou utiliser le signet fourni dans l'onglet Importer) ou charger un CSV/JSON, puis vérifier avant de sauvegarder, dans le respect des conditions d'utilisation de la source. Les intitulés des classes ISO 9999 sont un résumé propre au projet (`lib/admin/iso9999.ts`), pas le texte de la norme. Les textes envoyés à l'IA sont traités par le fournisseur choisi : n'y mettre aucune donnée personnelle. Tout ce que l'IA produit est une estimation à vérifier (coûts, délais, programmes de financement) ; les totaux de Pugh sont recalculés par le code, pas par l'IA.

**Tests.** `npm run test:unit` (jeton Access, import, scores, export) et `scripts/admin-check.mjs` (parcours complet dans Chrome avec axe-core, y compris 320 px et réglages extrêmes) contre un Worker local et une fausse IA (`scripts/mock-llm.mjs`), exécutés par la CI.

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
| Variable de build `NEXT_PUBLIC_SITE_URL` (facultative) | remplace l'adresse publique par défaut `https://institut-lemoine.fr` (sans `/` final) |

Vérification locale sans rien publier : `npx wrangler deploy --dry-run`.

`public/_headers` est lu par Cloudflare : en-têtes de sécurité, type MIME de `/opengraph-image` et du worker PDF, cache long pour `/_next/static/`.

**Réglages Cloudflare à vérifier pour rester cohérent avec la politique de confidentialité et l'accessibilité :**
- *Web Analytics* (balise automatique « beacon ») : désactivé, sinon un script tiers est ajouté et la politique de confidentialité devient inexacte.
- *Email Address Obfuscation* : désactivé (Scrape Shield), il remplace le lien `mailto:` par un script.
- *Rocket Loader* et *Auto Minify* : désactivés (ils modifient les scripts de la page).
- Après la mise en ligne, refaire le test Lighthouse sur l'adresse publique.
