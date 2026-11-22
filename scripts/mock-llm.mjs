// Låtsas-AI för lokal utveckling och test : svarar som ett OpenAI-kompatibelt API (/v1/chat/completions)
// med fasta, giltiga svar. Används med LLM_PROVIDER=openai och LLM_BASE_URL=http://127.0.0.1:8799/v1.
import { createServer } from "node:http";

const analysis = {
  bottlenecks: ["Specialhårdvara kostar flera tusen euro.", "Programvaran kräver en dyr licens och är inte WCAG-anpassad."],
  proposal: {
    title: "Webbläsarbaserad talsyntes (PWA)",
    approach: "software",
    summary: "En gratis och offlinefungerande webbapp som ersätter dyr specialhårdvara.",
    description: "Appen använder webbläsarens talsyntes och ett stort, högkontrastigt gränssnitt som fungerar med enbart tangentbord.",
    key_features: ["Fungerar offline", "Stora knappar och hög kontrast", "Öppen källkod"],
    accessibility_notes: "WCAG 2.2 AA, tangentbordsnavigering och stöd för skärmläsare.",
  },
  feasibility: {
    difficulty: 2,
    effort_estimate: "6–10 personveckor för en första prototyp (uppskattning)",
    build_cost_estimate: "Låg : främst arbetstid (uppskattning)",
    unit_cost_estimate: "0 € per enhet, drift under 20 €/månad (uppskattning)",
    market_price_comparison: "Befintlig lösning cirka 1 200 € mot nästan 0 € per användare (grov uppskattning)",
    market_price_eur: 1200,
    assumptions: ["Målgruppen har tillgång till en smartphone eller dator."],
    risks: ["Röstkvaliteten varierar mellan webbläsare."],
  },
  bom: [
    { item: "Mikrokontroller", quantity: 2, unit_cost_eur: 4.5, note: "ESP32", cheaper_alternative: "Använd smartphonen i stället" },
    { item: "Hölje (3D-print)", quantity: 1, unit_cost_eur: 6, note: "PLA, 40 g", cheaper_alternative: "Mindre hölje" },
    { item: "Hosting och support per användare och år", quantity: 1, unit_cost_eur: 12 },
  ],
  impact: {
    beneficiaries: "Personer med tal- eller kommunikationssvårigheter",
    grant_fit: 4,
    grant_fit_rationale: "Hög samhällsnytta och öppen källkod.",
    funding_tracks: ["Stiftelser som Fondation Orange (verifiera villkor och datum)"],
    open_source_potential: "Hög : kan släppas under en fri licens.",
    scalability: "God : en webbapp skalar utan ny hårdvara.",
  },
  swot: {
    strengths: ["Låg kostnad"],
    weaknesses: ["Beroende av webbläsarens röster"],
    opportunities: ["Många användare utan råd med specialhjälpmedel"],
    threats: ["Konkurrens från stora aktörer"],
  },
  pugh: {
    baseline: "Befintlig kommunikationsenhet",
    criteria: [
      { name: "Kostnad", weight: 5 },
      { name: "Tillgänglighet", weight: 5 },
      { name: "Enkelhet att bygga", weight: 3 },
      { name: "Underhåll och skalbarhet", weight: 3 },
      { name: "Funktionstäckning", weight: 4 },
    ],
    options: [
      { name: "Webbläsarbaserad talsyntes", scores: [1, 1, 1, 1, 0] },
      { name: "Hybrid med 3D-printad hållare", scores: [1, 1, -1, 0, 1] },
    ],
  },
};

const extraction = {
  products: [
    { name: "Talapparat Z", iso_code: "22 21", manufacturer: "Exempel AB", price_min_eur: 1200, price_max_eur: 1500, function: "Tal från text", limitations: ["Dyr", "Kräver licens"] },
  ],
};

const brainstorm = {
  concepts: [
    { title: "Kommunikationsapp för smartphone", approach: "software", summary: "En PWA med symboler och talsyntes.", target_group: "Personer utan tal", how_cheaper: "Använder en smartphone som användaren redan äger.", unit_cost_eur: 12, market_price_eur: 1200, difficulty: 2 },
    { title: "3D-printad ögonstyrd pekare", approach: "hybrid", summary: "Billig ramhållare med webbkamerabaserad blickstyrning.", target_group: "Personer med svåra rörelsehinder", how_cheaper: "Öppen programvara och printad mekanik.", unit_cost_eur: 45, market_price_eur: 2500, difficulty: 4 },
    { title: "Enkel knappmatris", approach: "3d_print", summary: "Stora knappar med USB.", target_group: "Personer med nedsatt finmotorik", how_cheaper: "Standardkomponenter.", unit_cost_eur: null, market_price_eur: null, difficulty: 3 },
  ],
};

// Billigare version : samma analys men lägre materialkostnad och en tydlig ändringslista.
const cheaper = {
  analysis: {
    ...analysis,
    proposal: { ...analysis.proposal, summary: "Version utan egen hårdvara : allt körs på användarens smartphone." },
    bom: [{ item: "Hosting och support per användare och år", quantity: 1, unit_cost_eur: 7.2, note: "Statisk PWA på CDN" }],
  },
  summary: "Hårdvaran är borttagen och driften förenklad.",
  changes: [
    { change: "Tog bort mikrokontrollern och höljet", effect: "−15 € per enhet" },
    { change: "Gick över till statisk hosting", effect: "−6 € per användare och år" },
  ],
};

// Finansiering : utlysning, matchning (ett svar per idé-id som finns i frågan) och ansökningsutkast.
const callExtraction = {
  title: "Appel à projets Numérique inclusif",
  funder: "Fondation Exemple",
  kind: "foundation",
  url: "",
  deadline: "2027-03-15",
  amount_min_eur: 5000,
  amount_max_eur: 20000,
  eligibility: "Associations loi 1901 déclarées depuis plus d'un an.",
  requirements: ["Statuts", "Budget prévisionnel", "Derniers comptes annuels"],
  summary: "Finansierar projekt som gör digitala tjänster tillgängliga för personer med funktionsnedsättning.",
  status: "new",
  next_step: "",
  next_step_date: null,
  notes: "",
};

const draft = {
  title: "Demande de soutien : Numérique inclusif",
  content:
    "# Demande de soutien\n\n## Contexte et besoin\nL'association Institut Lemoine Accessibilité développe des solutions numériques accessibles.\n\n## Budget\n[À COMPLÉTER: budget détaillé]\n\n## Organisation\n[À COMPLÉTER: composition du bureau, numéro RNA]\n",
};

function matchesFor(userText) {
  const ids = [...userText.matchAll(/"id": "([0-9a-f-]{36})"/g)].map((m) => m[1]);
  return {
    matches: ids.map((id, i) => ({
      idea_id: id,
      score: i === 0 ? 4 : 2,
      rationale: i === 0 ? "Passar väl med utlysningens syfte." : "Svagare koppling till utlysningen.",
      gaps: i === 0 ? ["Kräver bokslut som föreningen ännu saknar."] : [],
    })),
  };
}

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let userText = "";
    try {
      userText = JSON.parse(body).messages.at(-1).content;
    } catch {
      // Anropet var inte JSON : svara med analysen.
    }
    const reply = body.includes("[UPPGIFT:EXTRAHERA]")
      ? extraction
      : body.includes("[UPPGIFT:BRAINSTORM]")
        ? brainstorm
        : body.includes("[UPPGIFT:BILLIGARE]")
          ? cheaper
          : body.includes("[UPPGIFT:UTLYSNING]")
            ? callExtraction
            : body.includes("[UPPGIFT:MATCHNING]")
              ? matchesFor(userText)
              : body.includes("[UPPGIFT:UTKAST]")
                ? draft
                : analysis;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
  });
}).listen(8799, "127.0.0.1", () => console.log("Låtsas-AI på http://127.0.0.1:8799/v1"));
