"use client";

import { useState } from "react";
import type { Product, ProductInput } from "@/lib/admin/schema";
import { api, errorMessage } from "./api";
import { Notice } from "./shared";

type Format = "text" | "csv" | "json";

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "text", label: "Klistra in text", hint: "AI:n plockar ut produktposterna. Kontrollera dem innan du sparar." },
  { value: "csv", label: "CSV", hint: "Första raden är kolumnnamn (namn, iso, tillverkare, pris, funktion, målgrupp, begränsningar …)." },
  { value: "json", label: "JSON", hint: "En lista med objekt, eller ett objekt med fältet « products »." },
];

// Kopierar markerad text (eller hela sidans text) till urklipp. Körs av administratören själv på
// den sida hen tittar på : ingen automatisk hämtning och ingen trafik mot databasen.
const BOOKMARKLET =
  "javascript:(()=>{const t=(getSelection().toString().trim()||document.body.innerText).slice(0,40000);navigator.clipboard.writeText(t).then(()=>alert('Texten är kopierad. Klistra in den i adminverktyget.'))})()";

export default function ImportView({ onSaved }: { onSaved: () => void }) {
  const [format, setFormat] = useState<Format>("text");
  const [content, setContent] = useState("");
  const [rows, setRows] = useState<ProductInput[] | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 200_000) {
      setMessage({ kind: "error", text: "Filen är för stor (högst 200 kB)." });
      return;
    }
    setContent(await file.text());
    if (/\.json$/i.test(file.name)) setFormat("json");
    else if (/\.(csv|tsv|txt)$/i.test(file.name)) setFormat(/\.txt$/i.test(file.name) ? "text" : "csv");
    setMessage(null);
  }

  async function preview() {
    setBusy(true);
    setMessage(format === "text" ? { kind: "info", text: "AI:n läser texten…" } : null);
    setRows(null);
    try {
      const result = await api<{ rows: ProductInput[]; warnings: string[] }>("/api/import/parse", {
        method: "POST",
        body: { format, content },
      });
      setRows(result.rows);
      setPicked(result.rows.map(() => true));
      setWarnings(result.warnings);
      setMessage({ kind: "info", text: `${result.rows.length} produkter hittades. Granska och spara.` });
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!rows) return;
    const chosen = rows.filter((_, i) => picked[i]);
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const { products } = await api<{ products: Product[] }>("/api/products/bulk", {
        method: "POST",
        body: { products: chosen },
      });
      setRows(null);
      setContent("");
      setWarnings([]);
      setMessage({ kind: "info", text: `${products.length} produkter sparades.` });
      onSaved();
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const current = FORMATS.find((f) => f.value === format)!;

  return (
    <section aria-labelledby="import-rubrik">
      <h2 id="import-rubrik">Importera produkter</h2>

      <div className="admin-card">
        <h3>Så hämtar du data på ett säkert sätt</h3>
        <p>
          Verktyget hämtar <strong>ingenting automatiskt</strong> från EASTIN (
          <a href="https://www.eastin.eu" target="_blank" rel="noopener noreferrer">
            eastin.eu<span className="visually-hidden"> (öppnas i ny flik)</span>
          </a>
          ) eller andra databaser, för att respektera deras användarvillkor. Sök själv på sajten, markera texten om de produkter du vill ha
          och klistra in den här, eller exportera/skriv av dem till en CSV- eller JSON-fil.
        </p>
        <p className="admin-hint">
          Genväg: skapa ett bokmärke i webbläsaren med koden nedan som adress. Klicka på bokmärket på en produktsida så kopieras den markerade
          texten (eller hela sidans text) till urklipp.
        </p>
        <div className="admin-field">
          <label htmlFor="bokmarke">Kod till bokmärket</label>
          <input id="bokmarke" readOnly value={BOOKMARKLET} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button
          type="button"
          className="button button-outline"
          onClick={async () => {
            await navigator.clipboard.writeText(BOOKMARKLET);
            setCopied(true);
          }}
        >
          Kopiera koden
        </button>
        {copied && <Notice kind="info">Koden är kopierad.</Notice>}
      </div>

      <div className="admin-card">
        <fieldset className="admin-fieldset">
          <legend>Format</legend>
          {FORMATS.map((f) => (
            <label key={f.value} className="admin-radio">
              <input type="radio" name="format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} />
              {f.label}
            </label>
          ))}
        </fieldset>
        <p className="admin-hint">{current.hint}</p>

        <div className="admin-field">
          <label htmlFor="import-fil">Ladda upp fil (valfritt, .csv .json .txt)</label>
          <input id="import-fil" type="file" accept=".csv,.json,.txt,.tsv,text/*,application/json" onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
        <div className="admin-field">
          <label htmlFor="import-innehall">Innehåll</label>
          <textarea id="import-innehall" rows={10} value={content} onChange={(e) => setContent(e.target.value)} maxLength={200_000} />
        </div>
        <button type="button" className="button button-primary" onClick={preview} disabled={busy || content.trim() === ""}>
          Förhandsgranska
        </button>
      </div>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      {warnings.length > 0 && (
        <div className="admin-card" role="group" aria-label="Varningar">
          <h3>Att kontrollera</h3>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="admin-card">
          <h3>Förhandsgranskning</h3>
          <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Förhandsgranskning av produkter">
            <table className="admin-table">
              <caption className="visually-hidden">Produkter som kan sparas</caption>
              <thead>
                <tr>
                  <th scope="col">Spara</th>
                  <th scope="col">Produkt</th>
                  <th scope="col">ISO</th>
                  <th scope="col">Pris (€)</th>
                  <th scope="col">Funktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Spara ${r.name}`}
                        checked={picked[i] ?? false}
                        onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                      />
                    </td>
                    <th scope="row">{r.name}</th>
                    <td>{r.iso_code || "–"}</td>
                    <td>{r.price_min_eur ?? "–"}</td>
                    <td>{r.function || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="button button-primary" onClick={save} disabled={busy || !picked.some(Boolean)}>
            Spara {picked.filter(Boolean).length} produkter
          </button>
        </div>
      )}
    </section>
  );
}
