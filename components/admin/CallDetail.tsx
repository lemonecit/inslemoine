"use client";

import { useState } from "react";
import {
  DRAFT_LANGUAGES,
  DRAFT_LANGUAGE_LABELS,
  FUNDER_KIND_LABELS,
  type CallDetail as CallDetailType,
  type ChecklistItem,
  type Draft,
} from "@/lib/admin/funding";
import type { Idea } from "@/lib/admin/schema";
import { api, errorMessage, useApi } from "./api";
import CallForm, { bodyFromForm, formFromCall, type CallFormState } from "./CallForm";
import { amountText, dueText } from "./FundingView";
import { ConfirmButton, Notice, Stars } from "./shared";

export default function CallDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [reload, setReload] = useState(0);
  const { data, error } = useApi<{ call: CallDetailType }>(`/api/calls/${id}`, reload);
  const call = data?.call;
  const refresh = () => {
    setReload((n) => n + 1);
    onChanged();
  };

  return (
    <section aria-labelledby="bidrag-rubrik">
      <p className="admin-no-print">
        <a
          href="#finansiering"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          ← Alla utlysningar
        </a>
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {/* Rubriken finns alltid i sidan så att fokus kan flyttas till den direkt vid byte av vy. */}
      <h2 id="bidrag-rubrik">{call ? call.title : "Hämtar utlysningen…"}</h2>
      {call && (
        <>
          <p className="admin-hint">
            {FUNDER_KIND_LABELS[call.kind]}
            {call.funder && ` · ${call.funder}`}
            {call.deadline && ` · deadline ${call.deadline} (${dueText(call.deadline).text})`} · belopp {amountText(call)}
          </p>
          <Notice kind="info">
            AI-genererat innehåll kan innehålla fel. Verifiera deadline, belopp och krav mot källan
            {call.url && (
              <>
                {" "}
                (
                <a href={call.url} target="_blank" rel="noopener noreferrer">
                  öppna källan<span className="visually-hidden"> (öppnas i ny flik)</span>
                </a>
                )
              </>
            )}
            .
          </Notice>
          <EditCard key={call.id} call={call} onSaved={refresh} onDeleted={() => {
            onChanged();
            onBack();
          }} />
          <MatchCard call={call} onChanged={refresh} />
          <ChecklistCard call={call} onChanged={refresh} />
          <DraftsCard call={call} onChanged={refresh} />
        </>
      )}
    </section>
  );
}

function EditCard({ call, onSaved, onDeleted }: { call: CallDetailType; onSaved: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState<CallFormState>(formFromCall(call));
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/calls/${call.id}`, { method: "PATCH", body: bodyFromForm(form) });
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
      await api(`/api/calls/${call.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    }
  }

  return (
    <form
      className="admin-card admin-form"
      aria-labelledby="bidrag-redigera"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 id="bidrag-redigera">Uppgifter och status</h3>
      <CallForm idPrefix="ec" value={form} onChange={setForm} showStatus />
      <div className="admin-actions">
        <button type="submit" className="button button-primary" disabled={busy || form.title.trim() === ""}>
          Spara ändringar
        </button>
        <ConfirmButton label="Ta bort utlysningen" confirmLabel="Ja, ta bort utlysningen" onConfirm={remove} />
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </form>
  );
}

function MatchCard({ call, onChanged }: { call: CallDetailType; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/calls/${call.id}/match`, { method: "POST", body: {} });
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      <h3>Matchning mot era idéer</h3>
      <p className="admin-hint">
        AI:n bedömer hur väl era senaste idéer passar utlysningen, med utgångspunkt i föreningsprofilen. Den är ärlig om hinder, till exempel krav på bokslut som
        en nystartad förening inte kan uppfylla.
      </p>
      <button type="button" className="button button-primary" onClick={run} disabled={busy}>
        {busy ? "AI:n bedömer…" : call.matches.length ? "Matcha på nytt" : "Matcha mot idéer"}
      </button>
      {busy && <Notice kind="info">AI:n bedömer idéerna. Det kan ta en halv minut…</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {call.matches.length > 0 && (
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Matchning mot idéer">
          <table className="admin-table">
            <caption className="visually-hidden">Hur väl varje idé passar utlysningen</caption>
            <thead>
              <tr>
                <th scope="col">Idé</th>
                <th scope="col">Passform</th>
                <th scope="col">Motivering</th>
                <th scope="col">Hinder och luckor</th>
              </tr>
            </thead>
            <tbody>
              {call.matches.map((m) => (
                <tr key={m.idea_id}>
                  <th scope="row">
                    <a href={`#ide/${m.idea_id}`}>{m.idea_title}</a>
                  </th>
                  <td>
                    <Stars value={m.score} label="Passform" />
                  </td>
                  <td>{m.rationale || "–"}</td>
                  <td>
                    {m.gaps.length ? (
                      <ul>
                        {m.gaps.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    ) : (
                      "–"
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

function ChecklistCard({ call, onChanged }: { call: CallDetailType; onChanged: () => void }) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const done = call.checklist.filter((i) => i.done).length;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const toggle = (item: ChecklistItem) =>
    run(() => api(`/api/calls/${call.id}/checklist/${item.id}`, { method: "PATCH", body: { done: !item.done } }));

  return (
    <div className="admin-card">
      <h3>Checklista för ansökan</h3>
      <p className="admin-hint">
        Standardunderlagen är vanliga hos franska finansiärer, men varje utlysning har egna regler. Kontrollera listan mot utlysningen.
      </p>
      <p role="status">
        {call.checklist.length ? `${done} av ${call.checklist.length} klara` : "Inga punkter ännu."}
      </p>
      {call.checklist.length > 0 && (
        <ul className="admin-checklist">
          {call.checklist.map((item) => (
            <li key={item.id}>
              <label className="admin-radio">
                <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
                <span className={item.done ? "admin-done" : undefined}>{item.label}</span>
              </label>
              <button
                type="button"
                className="button button-outline"
                onClick={() => run(() => api(`/api/calls/${call.id}/checklist/${item.id}`, { method: "DELETE" }))}
                aria-label={`Ta bort punkten: ${item.label}`}
              >
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={() => run(() => api(`/api/calls/${call.id}/checklist/generate`, { method: "POST", body: { include_standard: true } }))}
        >
          Skapa från krav och standardunderlag
        </button>
        <button
          type="button"
          className="button button-outline"
          onClick={() => run(() => api(`/api/calls/${call.id}/checklist/generate`, { method: "POST", body: { include_standard: false } }))}
          disabled={call.requirements.length === 0}
        >
          Bara utlysningens krav
        </button>
      </div>
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          void run(async () => {
            await api(`/api/calls/${call.id}/checklist`, { method: "POST", body: { label } });
            setLabel("");
          });
        }}
      >
        <div className="admin-field">
          <label htmlFor="cl-ny">Egen punkt</label>
          <input id="cl-ny" value={label} maxLength={300} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button type="submit" className="button button-outline" disabled={!label.trim()}>
          Lägg till
        </button>
      </form>
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}

function DraftsCard({ call, onChanged }: { call: CallDetailType; onChanged: () => void }) {
  const { data: ideasData } = useApi<{ ideas: Idea[] }>("/api/ideas?sort=updated");
  const ideas = ideasData?.ideas ?? [];
  const [ideaId, setIdeaId] = useState("");
  const [language, setLanguage] = useState<string>("fr");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { draft } = await api<{ draft: Draft }>(`/api/calls/${call.id}/drafts`, {
        method: "POST",
        body: { idea_id: ideaId || undefined, language, instructions },
      });
      setOpen(draft.id);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      <h3>Ansökningsutkast</h3>
      <p className="admin-hint">
        AI:n skriver ett första utkast utifrån utlysningen, föreningsprofilen och vald idé. Uppgifter som saknas blir platshållare i formen [À COMPLÉTER: …].
        Utkastet ska granskas och skrivas om av en människa innan det skickas.
      </p>
      <div className="admin-grid">
        <div className="admin-field">
          <label htmlFor="dr-idea">Idé att basera utkastet på</label>
          <select id="dr-idea" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
            <option value="">Ingen specifik idé</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="dr-lang">Språk</label>
          <select id="dr-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {DRAFT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {DRAFT_LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-field">
        <label htmlFor="dr-instr">Särskilda önskemål (valfritt)</label>
        <input
          id="dr-instr"
          value={instructions}
          maxLength={1000}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="t.ex. betona öppen källkod och att lösningen är gratis för användaren"
        />
      </div>
      <button type="button" className="button button-primary" onClick={generate} disabled={busy}>
        {busy ? "AI:n skriver…" : "Skriv utkast"}
      </button>
      {busy && <Notice kind="info">AI:n skriver utkastet. Det kan ta upp till en minut…</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      {call.drafts.length > 0 && (
        <>
          <h4>Sparade utkast</h4>
          <ul>
            {call.drafts.map((d) => (
              <li key={d.id}>
                <button type="button" className="link-button" onClick={() => setOpen(d.id)} aria-expanded={open === d.id}>
                  {d.title}
                </button>{" "}
                <span className="admin-sub">
                  {DRAFT_LANGUAGE_LABELS[d.language as keyof typeof DRAFT_LANGUAGE_LABELS] ?? d.language} · ändrad {d.updated_at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {open && <DraftLoader key={open} id={open} onChanged={onChanged} onClosed={() => setOpen(null)} />}
    </div>
  );
}

function DraftLoader({ id, onChanged, onClosed }: { id: string; onChanged: () => void; onClosed: () => void }) {
  const { data, error } = useApi<{ draft: Draft }>(`/api/drafts/${id}`);
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <p>Hämtar utkastet…</p>;
  return <DraftEditor draft={data.draft} onChanged={onChanged} onClosed={onClosed} />;
}

function DraftEditor({ draft, onChanged, onClosed }: { draft: Draft; onChanged: () => void; onClosed: () => void }) {
  const [title, setTitle] = useState(draft.title);
  const [content, setContent] = useState(draft.content);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = (content.match(/\[À COMPLÉTER/gi) ?? []).length;

  async function save() {
    setBusy(true);
    try {
      await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: { title, content } });
      setMessage({ kind: "info", text: "Utkastet är sparat." });
      onChanged();
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/drafts/${draft.id}`, { method: "DELETE" });
      onChanged();
      onClosed();
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    }
  }

  return (
    <div className="admin-result" role="region" aria-label={`Utkast: ${draft.title}`}>
      <h4>Redigera utkast</h4>
      <p role="status">
        {missing > 0
          ? `${missing} platshållare [À COMPLÉTER] återstår att fylla i.`
          : "Inga platshållare kvar : kontrollera ändå alla fakta innan du skickar."}
      </p>
      <div className="admin-field">
        <label htmlFor="dr-title">Rubrik</label>
        <input id="dr-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="admin-field">
        <label htmlFor="dr-content">Text (markdown)</label>
        <textarea id="dr-content" rows={26} value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div className="admin-actions">
        <button type="button" className="button button-primary" onClick={save} disabled={busy}>
          Spara utkast
        </button>
        <a className="button button-outline" href={`/api/drafts/${draft.id}/export.md`} download>
          Exportera Markdown
        </a>
        <button type="button" className="button button-outline" onClick={onClosed}>
          Stäng
        </button>
        <ConfirmButton label="Ta bort utkastet" confirmLabel="Ja, ta bort utkastet" onConfirm={remove} />
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </div>
  );
}
