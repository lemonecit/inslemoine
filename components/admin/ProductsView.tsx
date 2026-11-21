"use client";

import { useState, type FormEvent } from "react";
import { isoClassTitle } from "@/lib/admin/iso9999";
import type { Idea, Product, ProductInput } from "@/lib/admin/schema";
import { api, errorMessage, useApi } from "./api";
import { ConfirmButton, IsoSelect, Notice } from "./shared";

const MAX_SELECTED = 8;

const EMPTY_FORM = {
  name: "",
  iso_code: "",
  manufacturer: "",
  price_min_eur: "",
  price_max_eur: "",
  price_note: "",
  function: "",
  target_group: "",
  limitations: "",
  source_url: "",
  notes: "",
};
type Form = typeof EMPTY_FORM;

function toForm(p: Product): Form {
  return {
    name: p.name,
    iso_code: p.iso_code,
    manufacturer: p.manufacturer,
    price_min_eur: p.price_min_eur === null ? "" : String(p.price_min_eur),
    price_max_eur: p.price_max_eur === null ? "" : String(p.price_max_eur),
    price_note: p.price_note,
    function: p.function,
    target_group: p.target_group,
    limitations: p.limitations.join("\n"),
    source_url: p.source_url,
    notes: p.notes,
  };
}

const num = (value: string) => {
  const n = Number(value.replace(",", ".").trim());
  return value.trim() === "" || !Number.isFinite(n) ? null : n;
};

function toInput(f: Form): Partial<ProductInput> {
  return {
    ...f,
    price_min_eur: num(f.price_min_eur),
    price_max_eur: num(f.price_max_eur),
    limitations: f.limitations.split("\n").map((l) => l.trim()).filter(Boolean),
  };
}

function priceText(p: Product): string {
  const { price_min_eur: min, price_max_eur: max } = p;
  if (min === null && max === null) return "–";
  if (min !== null && max !== null && min !== max) return `${min}–${max} €`;
  return `${min ?? max} €`;
}

export default function ProductsView({ onOpenIdea }: { onOpenIdea: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [isoClass, setIsoClass] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [focus, setFocus] = useState("");
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const query = new URLSearchParams();
  if (q.trim()) query.set("q", q.trim());
  if (isoClass) query.set("iso_class", isoClass);
  const { data, error, loading } = useApi<{ products: Product[] }>(`/api/products?${query}`, reload);
  const products = data?.products ?? [];

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_SELECTED ? [...s, id] : s));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(editing.id ? `/api/products/${editing.id}` : "/api/products", {
        method: editing.id ? "PATCH" : "POST",
        body: toInput(editing.form),
      });
      setEditing(null);
      setReload((n) => n + 1);
      setMessage({ kind: "info", text: "Produkten är sparad." });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/products/${id}`, { method: "DELETE" });
      setSelected((s) => s.filter((x) => x !== id));
      setReload((n) => n + 1);
      setMessage({ kind: "info", text: "Produkten är borttagen." });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    }
  }

  async function analyze() {
    setBusy(true);
    setMessage({ kind: "info", text: "AI-analysen pågår. Det kan ta upp till en minut…" });
    try {
      const { idea } = await api<{ idea: Idea }>("/api/analyze", {
        method: "POST",
        body: { product_ids: selected, iso_class: selected.length ? undefined : isoClass || undefined, focus },
      });
      onOpenIdea(idea.id);
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
      setBusy(false);
    }
  }

  const setField = (field: keyof Form) => (value: string) =>
    setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, [field]: value } } : cur));
  const canAnalyze = !busy && (selected.length > 0 || isoClass !== "");

  return (
    <section aria-labelledby="produkter-rubrik">
      <h2 id="produkter-rubrik">Befintliga produkter</h2>

      <div className="admin-toolbar">
        <div className="admin-field">
          <label htmlFor="produkt-sok">Sök</label>
          <input id="produkt-sok" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <IsoSelect id="produkt-iso" label="ISO 9999-klass" value={isoClass} onChange={setIsoClass} />
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            setEditing({ id: null, form: EMPTY_FORM });
            setMessage(null);
          }}
        >
          Ny produkt
        </button>
      </div>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      {editing && (
        <form className="admin-card admin-form" onSubmit={save} aria-labelledby="produkt-form-rubrik">
          <h3 id="produkt-form-rubrik">{editing.id ? "Redigera produkt" : "Ny produkt"}</h3>
          <div className="admin-grid">
            <TextField id="f-name" label="Produktnamn" required value={editing.form.name} onChange={setField("name")} />
            <TextField
              id="f-iso"
              label="ISO 9999-kod"
              hint="t.ex. 22 03 18 (2, 4 eller 6 siffror)"
              value={editing.form.iso_code}
              onChange={setField("iso_code")}
            />
            <TextField id="f-man" label="Tillverkare" value={editing.form.manufacturer} onChange={setField("manufacturer")} />
            <TextField id="f-pmin" label="Pris från (€)" inputMode="decimal" value={editing.form.price_min_eur} onChange={setField("price_min_eur")} />
            <TextField id="f-pmax" label="Pris till (€)" inputMode="decimal" value={editing.form.price_max_eur} onChange={setField("price_max_eur")} />
            <TextField id="f-pnote" label="Priskommentar" value={editing.form.price_note} onChange={setField("price_note")} />
            <TextField id="f-target" label="Målgrupp" value={editing.form.target_group} onChange={setField("target_group")} />
            <TextField id="f-url" label="Källa (länk)" type="url" value={editing.form.source_url} onChange={setField("source_url")} />
          </div>
          <TextArea id="f-func" label="Funktion" value={editing.form.function} onChange={setField("function")} />
          <TextArea
            id="f-lim"
            label="Kända begränsningar"
            hint="En per rad, t.ex. « dyr specialhårdvara », « kräver Windows-licens », « ej WCAG-anpassad »"
            value={editing.form.limitations}
            onChange={setField("limitations")}
          />
          <TextArea id="f-notes" label="Anteckningar" value={editing.form.notes} onChange={setField("notes")} />
          <div className="admin-actions">
            <button type="submit" className="button button-primary" disabled={busy}>
              Spara
            </button>
            <button type="button" className="button button-outline" onClick={() => setEditing(null)}>
              Avbryt
            </button>
          </div>
        </form>
      )}

      <div className="admin-card">
        <h3>Analysera med AI</h3>
        <p className="admin-hint">
          Markera upp till {MAX_SELECTED} produkter i listan, eller välj en ISO-klass utan markering för att analysera klassens senaste produkter.
          Resultatet sparas som ett utkast under Idéer.
        </p>
        <div className="admin-field">
          <label htmlFor="analys-fokus">Särskilt fokus (valfritt)</label>
          <input
            id="analys-fokus"
            value={focus}
            maxLength={600}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="t.ex. lösning som fungerar offline och kostar under 50 €"
          />
        </div>
        <button type="button" className="button button-primary" onClick={analyze} disabled={!canAnalyze}>
          {selected.length > 0
            ? `Analysera ${selected.length} markerade`
            : isoClass
              ? `Analysera klass ${isoClass}`
              : "Markera produkter eller välj klass"}
        </button>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? (
        <p>Hämtar produkter…</p>
      ) : products.length === 0 ? (
        <p>Inga produkter ännu. Lägg till en eller använd fliken Importera.</p>
      ) : (
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Lista över produkter">
          <table className="admin-table">
            <caption className="visually-hidden">Befintliga produkter</caption>
            <thead>
              <tr>
                <th scope="col">Välj</th>
                <th scope="col">Produkt</th>
                <th scope="col">ISO</th>
                <th scope="col">Pris</th>
                <th scope="col">Funktion och begränsningar</th>
                <th scope="col">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Välj ${p.name}`}
                      checked={selected.includes(p.id)}
                      onChange={() => toggle(p.id)}
                      disabled={!selected.includes(p.id) && selected.length >= MAX_SELECTED}
                    />
                  </td>
                  <th scope="row">
                    {p.name}
                    {p.manufacturer && <span className="admin-sub">{p.manufacturer}</span>}
                  </th>
                  <td>
                    {p.iso_code || "–"}
                    {p.iso_class && <span className="admin-sub">{isoClassTitle(p.iso_class)}</span>}
                  </td>
                  <td>{priceText(p)}</td>
                  <td>
                    {p.function || "–"}
                    {p.limitations.length > 0 && <span className="admin-sub">Begränsningar: {p.limitations.join("; ")}</span>}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => {
                          setEditing({ id: p.id, form: toForm(p) });
                          setMessage(null);
                        }}
                        aria-label={`Redigera ${p.name}`}
                      >
                        Redigera
                      </button>
                      <ConfirmButton label="Ta bort" confirmLabel={`Ta bort ${p.name}`} onConfirm={() => remove(p.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  type?: string;
  inputMode?: "decimal";
};

function TextField({ id, label, value, onChange, hint, required, type = "text", inputMode }: FieldProps) {
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span id={`${id}-hint`} className="admin-hint">
          {hint}
        </span>
      )}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextArea({ id, label, value, onChange, hint }: FieldProps) {
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span id={`${id}-hint`} className="admin-hint">
          {hint}
        </span>
      )}
      <textarea id={id} rows={3} value={value} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export { TextField, TextArea };
