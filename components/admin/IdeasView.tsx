"use client";

import { useState } from "react";
import { isoClassTitle } from "@/lib/admin/iso9999";
import { APPROACH_LABELS, IDEA_STATUSES, STATUS_LABELS, type Idea } from "@/lib/admin/schema";
import { useApi } from "./api";
import { IsoSelect, Notice, Stars } from "./shared";

const SORTS = [
  { value: "updated", label: "Senast ändrad" },
  { value: "grant", label: "Bidragspotential" },
  { value: "buildability", label: "Enkel att bygga" },
  { value: "iso", label: "ISO-klass" },
];

export default function IdeasView({ onOpen, reloadKey }: { onOpen: (id: string) => void; reloadKey: number }) {
  const [status, setStatus] = useState("");
  const [isoClass, setIsoClass] = useState("");
  const [sort, setSort] = useState("updated");
  const [sprintOnly, setSprintOnly] = useState(false);

  const query = new URLSearchParams({ sort });
  if (status) query.set("status", status);
  if (isoClass) query.set("iso_class", isoClass);
  if (sprintOnly) query.set("next_sprint", "1");
  const { data, error, loading } = useApi<{ ideas: Idea[] }>(`/api/ideas?${query}`, reloadKey);
  const ideas = data?.ideas ?? [];

  return (
    <section aria-labelledby="ideer-rubrik">
      <h2 id="ideer-rubrik">Prototypidéer</h2>

      <div className="admin-toolbar">
        <div className="admin-field">
          <label htmlFor="idea-status">Status</label>
          <select id="idea-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alla</option>
            {IDEA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <IsoSelect id="idea-iso" label="ISO 9999-klass" value={isoClass} onChange={setIsoClass} />
        <div className="admin-field">
          <label htmlFor="idea-sort">Sortera efter</label>
          <select id="idea-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <label className="admin-radio">
          <input type="checkbox" checked={sprintOnly} onChange={(e) => setSprintOnly(e.target.checked)} />
          Bara nästa sprint
        </label>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data ? (
        <p>Hämtar idéer…</p>
      ) : ideas.length === 0 ? (
        <p>Inga idéer ännu. Gå till Produkter, markera några och välj « Analysera med AI ».</p>
      ) : (
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Lista över idéer">
          <table className="admin-table">
            <caption className="visually-hidden">Prototypidéer</caption>
            <thead>
              <tr>
                <th scope="col">Idé</th>
                <th scope="col">Typ</th>
                <th scope="col">ISO</th>
                <th scope="col">Status</th>
                <th scope="col">Bidragspotential</th>
                <th scope="col">Enkel att bygga</th>
                <th scope="col">Sprint</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((idea) => (
                <tr key={idea.id}>
                  <th scope="row">
                    <a
                      href={`#ide/${idea.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onOpen(idea.id);
                      }}
                    >
                      {idea.title}
                    </a>
                    <span className="admin-sub">{idea.products.map((p) => p.name).join(", ")}</span>
                  </th>
                  <td>{APPROACH_LABELS[idea.approach]}</td>
                  <td>{idea.iso_class ? `${idea.iso_class} ${isoClassTitle(idea.iso_class)}` : "–"}</td>
                  <td>{STATUS_LABELS[idea.status]}</td>
                  <td>
                    <Stars value={idea.grant_fit} label="Bidragspotential" />
                  </td>
                  <td>
                    <Stars value={idea.buildability} label="Enkel att bygga" />
                  </td>
                  <td>{idea.next_sprint ? "Ja" : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
