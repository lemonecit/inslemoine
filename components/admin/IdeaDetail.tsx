"use client";

import { useState } from "react";
import { isoClassTitle } from "@/lib/admin/iso9999";
import {
  APPROACH_LABELS,
  IDEA_STATUSES,
  STATUS_LABELS,
  type Analysis,
  type Idea,
  type IdeaStatus,
  type VersionInfo,
} from "@/lib/admin/schema";
import { costSummary, pughTotals } from "@/lib/admin/scoring";
import { api, errorMessage, useApi } from "./api";
import { TextArea, TextField } from "./ProductsView";
import { ConfirmButton, Notice } from "./shared";

const eur = (n: number | null) => (n === null ? "okänt" : `${n.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} €`);

const SOURCE_LABELS = { initial: "Första analysen", cheaper: "Gjord billigare", restore: "Återställd" } as const;

function BomCard({ analysis }: { analysis: Analysis }) {
  const cost = costSummary(analysis);
  return (
    <div className="admin-card">
      <h3>Materiallista och kostnad (uppskattning)</h3>
      {analysis.bom.length === 0 ? (
        <p className="admin-hint">
          Den här versionen har ingen materiallista. Kör « Gör billigare » nedan, eller skapa idén på nytt, så tas en fram.
        </p>
      ) : (
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Materiallista">
          <table className="admin-table">
            <caption className="visually-hidden">Materiallista med antal, styckpris och summa</caption>
            <thead>
              <tr>
                <th scope="col">Post</th>
                <th scope="col">Antal</th>
                <th scope="col">Styckpris</th>
                <th scope="col">Summa</th>
                <th scope="col">Billigare alternativ</th>
              </tr>
            </thead>
            <tbody>
              {analysis.bom.map((r, i) => (
                <tr key={i}>
                  <th scope="row">
                    {r.item}
                    {r.note && <span className="admin-sub">{r.note}</span>}
                  </th>
                  <td>{r.quantity}</td>
                  <td>{eur(r.unit_cost_eur)}</td>
                  <td>{eur(Math.round(r.quantity * r.unit_cost_eur * 100) / 100)}</td>
                  <td>{r.cheaper_alternative || "–"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Summa per enhet</th>
                <td />
                <td />
                <td>
                  <strong>{eur(cost.unit_cost_eur)}</strong>
                </td>
                <td>
                  Marknadspris: {eur(cost.market_price_eur)}
                  {cost.saving_pct !== null && ` · ungefär ${cost.saving_pct} % billigare`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function CheaperCard({
  idea,
  last,
  onNewVersion,
}: {
  idea: Idea;
  last: CheaperResult | null;
  onNewVersion: (result: CheaperResult | null) => void;
}) {
  const [target, setTarget] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const t = target.trim() === "" ? undefined : Number(target.replace(",", "."));
      const result = await api<{
        idea: Idea;
        cost_before: number | null;
        cost_after: number | null;
        cheaper: boolean | null;
      }>(`/api/ideas/${idea.id}/cheaper`, {
        method: "POST",
        body: { target_cost_eur: Number.isFinite(t) ? t : undefined, hint },
      });
      const versions = await api<{ versions: VersionInfo[] }>(`/api/ideas/${idea.id}/versions`);
      const newest = versions.versions[0];
      onNewVersion({
        version: result.idea.version,
        summary: newest?.summary ?? "",
        changes: newest?.changes ?? [],
        before: result.cost_before,
        after: result.cost_after,
        cheaper: result.cheaper,
      });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="admin-card admin-no-print">
      <h3>Gör billigare</h3>
      <p className="admin-hint">
        AI:n tar fram en ny version av idén med lägre kostnad: billigare komponenter, färre delar, mer mjukvara eller öppen källkod. Tillgängligheten får inte
        försämras. Den gamla versionen sparas och kan återställas.
      </p>
      <div className="admin-grid">
        <div className="admin-field">
          <label htmlFor="ch-target">Målkostnad per enhet (€, valfritt)</label>
          <input id="ch-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="admin-field">
          <label htmlFor="ch-hint">Tips till AI:n (valfritt)</label>
          <input
            id="ch-hint"
            value={hint}
            maxLength={600}
            onChange={(e) => setHint(e.target.value)}
            placeholder="t.ex. använd en vanlig smartphone i stället för egen skärm"
          />
        </div>
      </div>
      <button type="button" className="button button-primary" onClick={run} disabled={busy}>
        {busy ? "AI:n arbetar…" : "Gör billigare"}
      </button>
      {busy && <Notice kind="info">AI:n tar fram en billigare version. Det kan ta upp till en minut…</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      {last && (
        <div role="region" aria-label="Resultat av senaste försöket" className="admin-result">
          <h4>Resultat: version {last.version}</h4>
          <p>
            <strong>Kostnad per enhet:</strong> {eur(last.before)} → {eur(last.after)}
            {last.before !== null && last.after !== null && last.before > 0 && ` (${Math.round((1 - last.after / last.before) * 100)} % lägre)`}
          </p>
          {last.cheaper === false && (
            <Notice kind="error">
              AI:n lyckades inte sänka kostnaden den här gången. Du kan återställa en tidigare version nedan eller försöka igen med ett tips.
            </Notice>
          )}
          {last.summary && <p>{last.summary}</p>}
          {last.changes.length > 0 && (
            <ul>
              {last.changes.map((c, i) => (
                <li key={i}>
                  {c.change} <span className="admin-sub">{c.effect}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function VersionsCard({ idea, onNewVersion }: { idea: Idea; onNewVersion: (result: CheaperResult | null) => void }) {
  const { data, error } = useApi<{ versions: VersionInfo[] }>(`/api/ideas/${idea.id}/versions`);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const versions = data?.versions ?? [];

  async function restore(version: number) {
    setRestoreError(null);
    try {
      await api(`/api/ideas/${idea.id}/restore`, { method: "POST", body: { version } });
      onNewVersion(null);
    } catch (e) {
      setRestoreError(errorMessage(e));
    }
  }

  return (
    <div className="admin-card admin-no-print">
      <h3>Versioner och kostnadsutveckling</h3>
      {error && <Notice kind="error">{error}</Notice>}
      {restoreError && <Notice kind="error">{restoreError}</Notice>}
      {versions.length > 0 && (
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Versioner">
          <table className="admin-table">
            <caption className="visually-hidden">Versioner av idén, nyast först</caption>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Typ</th>
                <th scope="col">Kostnad per enhet</th>
                <th scope="col">Besparing mot marknad</th>
                <th scope="col">Sammanfattning</th>
                <th scope="col">Åtgärd</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version}>
                  <th scope="row">
                    {v.version}
                    {v.version === idea.version && <span className="admin-sub">nuvarande</span>}
                  </th>
                  <td>{SOURCE_LABELS[v.source]}</td>
                  <td>{eur(v.unit_cost_eur)}</td>
                  <td>{v.saving_pct === null ? "–" : `${v.saving_pct} %`}</td>
                  <td>{v.summary || "–"}</td>
                  <td>
                    {v.version === idea.version ? (
                      "–"
                    ) : (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => restore(v.version)}
                        aria-label={`Återställ version ${v.version}`}
                      >
                        Återställ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="admin-hint">Inga uppgifter.</p>
  );
}

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function PughTable({ pugh }: { pugh: Analysis["pugh"] }) {
  const totals = pughTotals(pugh);
  const best = Math.max(...totals.map((t) => t.weighted));
  return (
    <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Pugh-matris">
      <table className="admin-table admin-pugh">
        <caption>
          Pugh-matris. Referens: {pugh.baseline}. +1 = bättre, 0 = likvärdig, −1 = sämre än referensen.
        </caption>
        <thead>
          <tr>
            <th scope="col">Kriterium</th>
            <th scope="col">Vikt</th>
            {pugh.options.map((o, i) => (
              <th scope="col" key={i}>
                {o.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pugh.criteria.map((c, row) => (
            <tr key={row}>
              <th scope="row">{c.name}</th>
              <td>{c.weight}</td>
              {pugh.options.map((o, i) => (
                <td key={i} data-score={Math.sign(o.scores[row])}>
                  {sign(o.scores[row])}
                  <span className="visually-hidden">{o.scores[row] > 0 ? " (bättre)" : o.scores[row] < 0 ? " (sämre)" : " (likvärdig)"}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Viktad summa</th>
            <td />
            {totals.map((t, i) => (
              <td key={i}>
                <strong>{sign(t.weighted)}</strong>
                {t.weighted === best && totals.length > 1 && <span className="admin-sub">högst</span>}
                <span className="admin-sub">
                  {t.better} bättre · {t.same} lika · {t.worse} sämre
                </span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export type CheaperResult = {
  version: number;
  summary: string;
  changes: { change: string; effect: string }[];
  before: number | null;
  after: number | null;
  cheaper: boolean | null;
};

export default function IdeaDetail({
  id,
  onBack,
  onChanged,
}: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [reload, setReload] = useState(0);
  const [last, setLast] = useState<CheaperResult | null>(null);
  const { data, error } = useApi<{ idea: Idea }>(`/api/ideas/${id}`, reload);
  const idea = data?.idea;

  return (
    <section aria-labelledby="idedetalj-rubrik">
      <p className="admin-no-print">
        <a
          href="#ideer"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          ← Alla idéer
        </a>
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {/* Rubriken finns alltid i sidan så att fokus kan flyttas till den direkt vid byte av vy. */}
      <h2 id="idedetalj-rubrik">{idea ? idea.title : "Hämtar idén…"}</h2>
      {idea && (
        // key = id + version : formuläret behåller sina värden efter « spara », men läses in på nytt
        // när en ny version har skapats (billigare eller återställd) så att gammal text inte skrivs över.
        <IdeaBody
          key={`${idea.id}:${idea.version}`}
          idea={idea}
          last={last}
          onNewVersion={(result) => {
            setLast(result);
            setReload((n) => n + 1);
            onChanged();
          }}
          onSaved={() => {
            setReload((n) => n + 1);
            onChanged();
          }}
          onDeleted={() => {
            onChanged();
            onBack();
          }}
        />
      )}
    </section>
  );
}

function IdeaBody({
  idea,
  last,
  onNewVersion,
  onSaved,
  onDeleted,
}: {
  idea: Idea;
  last: CheaperResult | null;
  onNewVersion: (result: CheaperResult | null) => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const a = idea.analysis;
  const [title, setTitle] = useState(idea.title);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [sprint, setSprint] = useState(idea.next_sprint);
  const [grant, setGrant] = useState(String(idea.grant_fit));
  const [build, setBuild] = useState(String(idea.buildability));
  const [notes, setNotes] = useState(idea.notes);
  const [summary, setSummary] = useState(a.proposal.summary);
  const [description, setDescription] = useState(a.proposal.description);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        body: {
          title,
          status,
          next_sprint: sprint,
          grant_fit: Number(grant),
          buildability: Number(build),
          notes,
          analysis: { ...a, proposal: { ...a.proposal, summary, description } },
        },
      });
      setMessage({ kind: "info", text: "Ändringarna är sparade." });
      onSaved();
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/ideas/${idea.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    }
  }

  const ratings = [1, 2, 3, 4, 5];
  const cost = costSummary(a);

  return (
    <>
      <p className="admin-hint">
        {APPROACH_LABELS[a.proposal.approach]} · ISO {idea.iso_class ? `${idea.iso_class} ${isoClassTitle(idea.iso_class)}` : "ej angiven"} ·
        genererad med {idea.model || "okänd modell"} · Baserad på: {idea.products.map((p) => p.name).join(", ") || "–"}
      </p>
      <Notice kind="info">
        Allt AI-genererat är uppskattningar och förslag. Verifiera kostnader, tider och finansieringsvillkor innan de används externt.
      </Notice>
      <p className="admin-costline">
        <strong>Kostnad per enhet:</strong> {eur(cost.unit_cost_eur)} · <strong>Marknad:</strong> {eur(cost.market_price_eur)}
        {cost.saving_pct !== null && ` · ungefär ${cost.saving_pct} % billigare`} · <strong>Version</strong> {idea.version}
      </p>

      <div className="admin-card admin-no-print">
        <h3>Hantera idén</h3>
        <div className="admin-grid">
          <TextField id="i-title" label="Titel" value={title} onChange={setTitle} />
          <div className="admin-field">
            <label htmlFor="i-status">Status</label>
            <select id="i-status" value={status} onChange={(e) => setStatus(e.target.value as IdeaStatus)}>
              {IDEA_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="i-grant">Bidragspotential (1–5)</label>
            <select id="i-grant" value={grant} onChange={(e) => setGrant(e.target.value)}>
              {ratings.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="i-build">Enkel att bygga (1–5)</label>
            <select id="i-build" value={build} onChange={(e) => setBuild(e.target.value)}>
              {ratings.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="admin-radio">
          <input type="checkbox" checked={sprint} onChange={(e) => setSprint(e.target.checked)} />
          Markera för nästa sprint
        </label>
        <TextArea id="i-summary" label="Förslagets sammanfattning (redigerbar)" value={summary} onChange={setSummary} />
        <TextArea id="i-desc" label="Förslagets beskrivning (redigerbar)" value={description} onChange={setDescription} />
        <TextArea id="i-notes" label="Egna tekniska anteckningar" value={notes} onChange={setNotes} />
        <div className="admin-actions">
          <button type="button" className="button button-primary" onClick={save} disabled={busy}>
            Spara ändringar
          </button>
          <a className="button button-outline" href={`/api/ideas/${idea.id}/export.md`} download>
            Exportera Markdown
          </a>
          <button type="button" className="button button-outline" onClick={() => window.print()}>
            Skriv ut / spara som PDF
          </button>
          <ConfirmButton label="Ta bort idén" confirmLabel="Ja, ta bort idén" onConfirm={remove} />
        </div>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </div>

      <div className="admin-card">
        <h3>Förslag på prototyp: {a.proposal.title}</h3>
        <p>{a.proposal.summary}</p>
        <p>{a.proposal.description}</p>
        <h4>Nyckelfunktioner</h4>
        <List items={a.proposal.key_features} />
        <h4>Tillgänglighet</h4>
        <p>{a.proposal.accessibility_notes}</p>
      </div>

      <div className="admin-card">
        <h3>Flaskhalsar i dagens lösningar</h3>
        <List items={a.bottlenecks} />
      </div>

      <div className="admin-card">
        <h3>Teknisk genomförbarhet och kostnadsbesparing</h3>
        <dl className="admin-dl">
          <dt>Svårighetsgrad (1–5)</dt>
          <dd>{a.feasibility.difficulty}</dd>
          <dt>Utvecklingsinsats</dt>
          <dd>{a.feasibility.effort_estimate}</dd>
          <dt>Utvecklingskostnad</dt>
          <dd>{a.feasibility.build_cost_estimate}</dd>
          <dt>Kostnad per enhet / drift</dt>
          <dd>{a.feasibility.unit_cost_estimate}</dd>
          <dt>Jämfört med marknadspris</dt>
          <dd>{a.feasibility.market_price_comparison}</dd>
        </dl>
        <h4>Antaganden</h4>
        <List items={a.feasibility.assumptions} />
        <h4>Risker</h4>
        <List items={a.feasibility.risks} />
      </div>

      <BomCard analysis={a} />

      <CheaperCard idea={idea} last={last} onNewVersion={onNewVersion} />

      <VersionsCard idea={idea} onNewVersion={onNewVersion} />

      <div className="admin-card">
        <h3>Samhällsnytta och bidragspotential</h3>
        <dl className="admin-dl">
          <dt>Målgrupp</dt>
          <dd>{a.impact.beneficiaries}</dd>
          <dt>Passform för bidrag (1–5)</dt>
          <dd>
            {a.impact.grant_fit}. {a.impact.grant_fit_rationale}
          </dd>
          <dt>Öppen källkod / freemium</dt>
          <dd>{a.impact.open_source_potential}</dd>
          <dt>Skalbarhet</dt>
          <dd>{a.impact.scalability}</dd>
        </dl>
        <h4>Möjliga finansieringsspår (verifiera villkor och datum)</h4>
        <List items={a.impact.funding_tracks} />
      </div>

      <div className="admin-card">
        <h3>SWOT</h3>
        <div className="admin-swot">
          <div>
            <h4>Styrkor</h4>
            <List items={a.swot.strengths} />
          </div>
          <div>
            <h4>Svagheter</h4>
            <List items={a.swot.weaknesses} />
          </div>
          <div>
            <h4>Möjligheter</h4>
            <List items={a.swot.opportunities} />
          </div>
          <div>
            <h4>Hot</h4>
            <List items={a.swot.threats} />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Pugh-matris</h3>
        <PughTable pugh={a.pugh} />
      </div>
    </>
  );
}
