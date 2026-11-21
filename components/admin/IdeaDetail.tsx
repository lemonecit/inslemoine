"use client";

import { useState } from "react";
import { isoClassTitle } from "@/lib/admin/iso9999";
import { APPROACH_LABELS, IDEA_STATUSES, STATUS_LABELS, type Analysis, type Idea, type IdeaStatus } from "@/lib/admin/schema";
import { pughTotals } from "@/lib/admin/scoring";
import { api, errorMessage, useApi } from "./api";
import { TextArea, TextField } from "./ProductsView";
import { ConfirmButton, Notice } from "./shared";

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
        // key = id : formuläret behåller sina värden och sitt « sparat »-meddelande efter att idén sparats.
        <IdeaBody
          key={idea.id}
          idea={idea}
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

function IdeaBody({ idea, onSaved, onDeleted }: { idea: Idea; onSaved: () => void; onDeleted: () => void }) {
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

  return (
    <>
      <p className="admin-hint">
        {APPROACH_LABELS[a.proposal.approach]} · ISO {idea.iso_class ? `${idea.iso_class} ${isoClassTitle(idea.iso_class)}` : "ej angiven"} ·
        genererad med {idea.model || "okänd modell"} · Baserad på: {idea.products.map((p) => p.name).join(", ") || "–"}
      </p>
      <Notice kind="info">
        Allt AI-genererat är uppskattningar och förslag. Verifiera kostnader, tider och finansieringsvillkor innan de används externt.
      </Notice>

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
