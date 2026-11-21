"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { APPROACH_LABELS, type Concept, type Idea } from "@/lib/admin/schema";
import { savingPercent } from "@/lib/admin/scoring";
import { api, errorMessage } from "./api";
import { IsoSelect, Notice } from "./shared";

export type BrainstormState = {
  need: string;
  isoClass: string;
  count: string;
  maxCost: string;
  concepts: Concept[];
};

export const EMPTY_BRAINSTORM: BrainstormState = { need: "", isoClass: "", count: "5", maxCost: "", concepts: [] };

const eur = (n: number | null) => (n === null ? "okänt" : `${n.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} €`);

// Tillståndet ägs av AdminApp så att idéerna finns kvar när du byter flik.
export default function BrainstormView({
  state,
  setState,
  onOpenIdea,
}: {
  state: BrainstormState;
  setState: Dispatch<SetStateAction<BrainstormState>>;
  onOpenIdea: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const set = <K extends keyof BrainstormState>(key: K, value: BrainstormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  async function generate() {
    setBusy("brainstorm");
    setMessage({ kind: "info", text: "AI:n tar fram idéer. Det kan ta en halv minut…" });
    try {
      const max = state.maxCost.trim() === "" ? undefined : Number(state.maxCost.replace(",", "."));
      const { concepts } = await api<{ concepts: Concept[] }>("/api/brainstorm", {
        method: "POST",
        body: {
          need: state.need,
          iso_class: state.isoClass || undefined,
          count: Number(state.count),
          max_unit_cost_eur: Number.isFinite(max) ? max : undefined,
        },
      });
      set("concepts", concepts);
      setMessage({ kind: "info", text: `${concepts.length} idéer. Välj de som ska utvecklas till en full analys.` });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function develop(concept: Concept, index: number) {
    setBusy(`develop-${index}`);
    setMessage({ kind: "info", text: `Utvecklar « ${concept.title} » till en full analys med materiallista. Det kan ta upp till en minut…` });
    try {
      const { idea } = await api<{ idea: Idea }>("/api/analyze", {
        method: "POST",
        body: { concept, iso_class: state.isoClass || undefined, focus: state.need.slice(0, 600) },
      });
      onOpenIdea(idea.id);
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="brainstorm-rubrik">
      <h2 id="brainstorm-rubrik">Brainstorma nya prototyper</h2>
      <p>
        Beskriv ett behov, så föreslår AI:n olika sätt att lösa det mycket billigare än idag. Du behöver ingen startprodukt. Välj sedan de idéer som
        ska utvecklas vidare, och använd « Gör billigare » på idén för att pressa kostnaden ännu mer.
      </p>

      <form
        className="admin-card"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <div className="admin-field">
          <label htmlFor="bs-need">Behov eller uppgift</label>
          <span id="bs-need-hint" className="admin-hint">
            t.ex. « Personer som inte kan tala behöver ett sätt att kommunicera med omgivningen »
          </span>
          <textarea
            id="bs-need"
            rows={4}
            required
            minLength={3}
            maxLength={1000}
            value={state.need}
            aria-describedby="bs-need-hint"
            onChange={(e) => set("need", e.target.value)}
          />
        </div>
        <div className="admin-grid">
          <IsoSelect id="bs-iso" label="ISO 9999-klass (valfritt)" value={state.isoClass} onChange={(v) => set("isoClass", v)} allLabel="Ingen vald" />
          <div className="admin-field">
            <label htmlFor="bs-count">Antal idéer</label>
            <select id="bs-count" value={state.count} onChange={(e) => set("count", e.target.value)}>
              {[3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="bs-max">Målkostnad per enhet (€, valfritt)</label>
            <input id="bs-max" inputMode="decimal" value={state.maxCost} onChange={(e) => set("maxCost", e.target.value)} />
          </div>
        </div>
        <button type="submit" className="button button-primary" disabled={busy !== null || state.need.trim().length < 3}>
          Ta fram idéer
        </button>
      </form>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      {state.concepts.length > 0 && (
        <ol className="admin-concepts" aria-label="Föreslagna idéer">
          {state.concepts.map((c, i) => {
            const saving = savingPercent(c.unit_cost_eur, c.market_price_eur);
            return (
              <li key={i} className="admin-card">
                <h3>{c.title}</h3>
                <p className="admin-hint">
                  {APPROACH_LABELS[c.approach]} · Svårighetsgrad {c.difficulty} av 5 · Målgrupp: {c.target_group}
                </p>
                <p>{c.summary}</p>
                <p>
                  <strong>Varför billigare:</strong> {c.how_cheaper}
                </p>
                <p>
                  <strong>Uppskattad kostnad:</strong> {eur(c.unit_cost_eur)} · <strong>Marknad:</strong> {eur(c.market_price_eur)}
                  {saving !== null && ` · ungefär ${saving} % billigare`}
                </p>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => develop(c, i)}
                  disabled={busy !== null}
                  aria-label={`Utveckla till idé: ${c.title}`}
                >
                  Utveckla till idé
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="admin-hint">Alla belopp är grova AI-uppskattningar som måste verifieras mot riktiga leverantörer innan något går vidare.</p>
    </section>
  );
}
