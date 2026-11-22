"use client";

import { useState } from "react";
import {
  CALL_STATUSES,
  CALL_STATUS_LABELS,
  FUNDER_KINDS,
  FUNDER_KIND_LABELS,
  daysUntil,
  type Call,
} from "@/lib/admin/funding";
import { api, errorMessage, useApi } from "./api";
import CallForm, { EMPTY_CALL_FORM, bodyFromForm, formFromCall, type CallFormState } from "./CallForm";
import { Notice, Stars } from "./shared";

const SORTS = [
  { value: "deadline", label: "Närmaste deadline" },
  { value: "fit", label: "Bäst passform" },
  { value: "updated", label: "Senast ändrad" },
];

const eur = (n: number | null) => (n === null ? null : `${n.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} €`);

export function amountText(c: { amount_min_eur: number | null; amount_max_eur: number | null }): string {
  const lo = eur(c.amount_min_eur);
  const hi = eur(c.amount_max_eur);
  if (lo && hi && lo !== hi) return `${lo}–${hi}`;
  return lo ?? hi ?? "–";
}

// « om 12 dagar », « idag », « 3 dagar sedan » : text som inte bara bygger på färg.
export function dueText(date: string, today = new Date()): { text: string; overdue: boolean } {
  const d = daysUntil(date, today);
  if (d === 0) return { text: "idag", overdue: false };
  if (d === 1) return { text: "imorgon", overdue: false };
  if (d > 1) return { text: `om ${d} dagar`, overdue: false };
  return { text: `${-d} ${d === -1 ? "dag" : "dagar"} sedan (passerat)`, overdue: true };
}

type Step = { date: string; label: string; call: Call };

function upcoming(calls: Call[], today: Date): Step[] {
  const steps: Step[] = [];
  for (const c of calls) {
    if (["granted", "rejected", "dropped"].includes(c.status)) continue;
    if (c.deadline) steps.push({ date: c.deadline, label: `Deadline: ${c.title}`, call: c });
    if (c.next_step_date) steps.push({ date: c.next_step_date, label: `${c.next_step || "Nästa steg"}: ${c.title}`, call: c });
  }
  // Passerade datum visas bara om de är nyliga, annars blir listan full av gammalt.
  return steps
    .filter((s) => daysUntil(s.date, today) >= -14)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
}

export default function FundingView({ onOpenCall }: { onOpenCall: (id: string) => void }) {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("deadline");
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState<"closed" | "paste" | "form">("closed");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [form, setForm] = useState<CallFormState>(EMPTY_CALL_FORM);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const query = new URLSearchParams({ sort });
  if (status === "open") query.set("open_only", "1");
  else if (status) query.set("status", status);
  if (kind) query.set("kind", kind);
  const { data, error, loading } = useApi<{ calls: Call[] }>(`/api/calls?${query}`, reload);
  const calls = data?.calls ?? [];
  const steps = upcoming(calls, new Date());

  async function summarize() {
    setBusy(true);
    setMessage({ kind: "info", text: "AI:n läser utlysningen…" });
    try {
      const { call, warnings: w } = await api<{ call: Parameters<typeof formFromCall>[0]; warnings: string[] }>("/api/calls/extract", {
        method: "POST",
        body: { text: source, url: sourceUrl },
      });
      setForm(formFromCall(call));
      setWarnings(w);
      setAdding("form");
      setMessage({ kind: "info", text: "Granska uppgifterna nedan och spara." });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const { call } = await api<{ call: Call }>("/api/calls", {
        method: "POST",
        body: { ...bodyFromForm(form), source_text: source },
      });
      setAdding("closed");
      setSource("");
      setSourceUrl("");
      setForm(EMPTY_CALL_FORM);
      setWarnings([]);
      setReload((n) => n + 1);
      setMessage({ kind: "info", text: `« ${call.title} » är sparad.` });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="fin-rubrik">
      <h2 id="fin-rubrik">Finansiering och bidrag</h2>
      <Notice kind="info">
        AI:n hittar inga bidrag åt dig och vet inte vilka som är öppna just nu. Du lägger in utlysningar från källor du litar på, och AI:n hjälper
        till att sammanfatta, bedöma passform och skriva utkast. Verifiera alltid deadline, belopp och krav mot källan.
      </Notice>

      <div className="admin-card">
        <h3>Kommande datum</h3>
        {steps.length === 0 ? (
          <p className="admin-hint">Inga kommande datum. Lägg in en utlysning med deadline eller ett datum för nästa steg.</p>
        ) : (
          <ol className="admin-timeline">
            {steps.map((s, i) => {
              const due = dueText(s.date);
              return (
                <li key={`${s.call.id}-${i}`} className={due.overdue ? "admin-overdue" : undefined}>
                  <time dateTime={s.date}>{s.date}</time> · <strong>{due.text}</strong> ·{" "}
                  <a
                    href={`#bidrag/${s.call.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenCall(s.call.id);
                    }}
                  >
                    {s.label}
                  </a>
                  {s.call.funder && <span className="admin-sub">{s.call.funder}</span>}
                </li>
              );
            })}
          </ol>
        )}
        <p>
          <a className="button button-outline" href="/api/calls/calendar.ics" download>
            Exportera till kalender (.ics)
          </a>
        </p>
      </div>

      <ProfileCard />

      <div className="admin-toolbar">
        <div className="admin-field">
          <label htmlFor="fin-status">Status</label>
          <select id="fin-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Pågående</option>
            <option value="">Alla</option>
            {CALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CALL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="fin-kind">Typ</label>
          <select id="fin-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Alla</option>
            {FUNDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {FUNDER_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="fin-sort">Sortera efter</label>
          <select id="fin-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="button button-primary" onClick={() => setAdding(adding === "closed" ? "paste" : "closed")}>
          {adding === "closed" ? "Ny utlysning" : "Avbryt"}
        </button>
      </div>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      {adding === "paste" && (
        <div className="admin-card">
          <h3>Ny utlysning</h3>
          <p className="admin-hint">
            Kopiera texten från utlysningens eller stiftelsens sida och klistra in den här. AI:n plockar ut deadline, belopp, vem som får söka och krav. Du granskar
            innan du sparar. Eller fyll i allt själv.
          </p>
          <div className="admin-field">
            <label htmlFor="fin-url">Länk till källan (valfritt)</label>
            <input id="fin-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </div>
          <div className="admin-field">
            <label htmlFor="fin-source">Text från utlysningen</label>
            <textarea id="fin-source" rows={10} maxLength={60000} value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="admin-actions">
            <button type="button" className="button button-primary" onClick={summarize} disabled={busy || source.trim().length < 20}>
              Sammanfatta med AI
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setForm({ ...EMPTY_CALL_FORM, url: sourceUrl });
                setWarnings([]);
                setAdding("form");
              }}
            >
              Fyll i själv
            </button>
          </div>
        </div>
      )}

      {adding === "form" && (
        <form
          className="admin-card admin-form"
          aria-labelledby="fin-form-rubrik"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3 id="fin-form-rubrik">Granska och spara</h3>
          {warnings.map((w) => (
            <Notice key={w} kind="info">
              {w}
            </Notice>
          ))}
          <CallForm idPrefix="nc" value={form} onChange={setForm} />
          <div className="admin-actions">
            <button type="submit" className="button button-primary" disabled={busy || form.title.trim() === ""}>
              Spara utlysning
            </button>
            <button type="button" className="button button-outline" onClick={() => setAdding("paste")}>
              Tillbaka
            </button>
          </div>
        </form>
      )}

      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? (
        <p>Hämtar utlysningar…</p>
      ) : calls.length === 0 ? (
        <p>Inga utlysningar ännu. Klicka på « Ny utlysning » och klistra in texten från en utlysning du hittat.</p>
      ) : (
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Lista över utlysningar">
          <table className="admin-table">
            <caption className="visually-hidden">Utlysningar och bidrag</caption>
            <thead>
              <tr>
                <th scope="col">Utlysning</th>
                <th scope="col">Typ</th>
                <th scope="col">Deadline</th>
                <th scope="col">Belopp</th>
                <th scope="col">Status</th>
                <th scope="col">Passform</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => {
                const due = c.deadline ? dueText(c.deadline) : null;
                return (
                  <tr key={c.id}>
                    <th scope="row">
                      <a
                        href={`#bidrag/${c.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenCall(c.id);
                        }}
                      >
                        {c.title}
                      </a>
                      {c.funder && <span className="admin-sub">{c.funder}</span>}
                    </th>
                    <td>{FUNDER_KIND_LABELS[c.kind]}</td>
                    <td className={due?.overdue ? "admin-overdue" : undefined}>
                      {c.deadline ? (
                        <>
                          <time dateTime={c.deadline}>{c.deadline}</time>
                          <span className="admin-sub">{due?.text}</span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td>{amountText(c)}</td>
                    <td>{CALL_STATUS_LABELS[c.status]}</td>
                    <td>{c.best_fit === null ? "–" : <Stars value={c.best_fit} label="Bästa passform mot en idé" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProfileCard() {
  const { data, error } = useApi<{ profile: string }>("/api/profile");
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? data?.profile ?? "";

  async function save() {
    setBusy(true);
    try {
      await api("/api/profile", { method: "PUT", body: { profile: value } });
      setDraft(null);
      setMessage({ kind: "info", text: "Profilen är sparad." });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="admin-card">
      <summary>
        <strong>Föreningsprofil</strong> (AI:n använder den vid matchning och utkast)
      </summary>
      <p className="admin-hint">
        Skriv bara sådant som är sant. AI:n får inte hitta på meriter, så allt som saknas här blir en platshållare i utkasten. Uppdatera profilen när
        RNA/SIRET, team och budget finns.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="admin-field">
        <label htmlFor="profil-text">Profil</label>
        <textarea id="profil-text" rows={12} maxLength={6000} value={value} onChange={(e) => setDraft(e.target.value)} />
      </div>
      <button type="button" className="button button-primary" onClick={save} disabled={busy || draft === null}>
        Spara profilen
      </button>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </details>
  );
}
