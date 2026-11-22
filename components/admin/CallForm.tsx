"use client";

import {
  CALL_STATUSES,
  CALL_STATUS_LABELS,
  FUNDER_KINDS,
  FUNDER_KIND_LABELS,
  type CallInput,
  type CallStatus,
  type FunderKind,
} from "@/lib/admin/funding";
import { TextArea, TextField } from "./ProductsView";

export type CallFormState = {
  title: string;
  funder: string;
  kind: FunderKind;
  url: string;
  deadline: string;
  amount_min_eur: string;
  amount_max_eur: string;
  eligibility: string;
  requirements: string;
  summary: string;
  status: CallStatus;
  next_step: string;
  next_step_date: string;
  notes: string;
};

export const EMPTY_CALL_FORM: CallFormState = {
  title: "",
  funder: "",
  kind: "other",
  url: "",
  deadline: "",
  amount_min_eur: "",
  amount_max_eur: "",
  eligibility: "",
  requirements: "",
  summary: "",
  status: "new",
  next_step: "",
  next_step_date: "",
  notes: "",
};

export function formFromCall(call: CallInput): CallFormState {
  return {
    title: call.title,
    funder: call.funder,
    kind: call.kind,
    url: call.url,
    deadline: call.deadline ?? "",
    amount_min_eur: call.amount_min_eur === null ? "" : String(call.amount_min_eur),
    amount_max_eur: call.amount_max_eur === null ? "" : String(call.amount_max_eur),
    eligibility: call.eligibility,
    requirements: call.requirements.join("\n"),
    summary: call.summary,
    status: call.status,
    next_step: call.next_step,
    next_step_date: call.next_step_date ?? "",
    notes: call.notes,
  };
}

// Det som skickas till servern : tomma datum och belopp blir null, kraven en lista.
export function bodyFromForm(f: CallFormState) {
  return {
    ...f,
    deadline: f.deadline || null,
    next_step_date: f.next_step_date || null,
    amount_min_eur: f.amount_min_eur.trim() === "" ? null : f.amount_min_eur.replace(",", "."),
    amount_max_eur: f.amount_max_eur.trim() === "" ? null : f.amount_max_eur.replace(",", "."),
    requirements: f.requirements.split("\n").map((l) => l.trim()).filter(Boolean),
  };
}

export default function CallForm({
  idPrefix,
  value,
  onChange,
  showStatus = false,
}: {
  idPrefix: string;
  value: CallFormState;
  onChange: (next: CallFormState) => void;
  showStatus?: boolean;
}) {
  const set = <K extends keyof CallFormState>(key: K) => (v: string) => onChange({ ...value, [key]: v as CallFormState[K] });
  return (
    <>
      <div className="admin-grid">
        <TextField id={`${idPrefix}-title`} label="Utlysning eller program" required value={value.title} onChange={set("title")} />
        <TextField id={`${idPrefix}-funder`} label="Finansiär" value={value.funder} onChange={set("funder")} />
        <div className="admin-field">
          <label htmlFor={`${idPrefix}-kind`}>Typ av finansiär</label>
          <select id={`${idPrefix}-kind`} value={value.kind} onChange={(e) => set("kind")(e.target.value)}>
            {FUNDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {FUNDER_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <TextField id={`${idPrefix}-url`} label="Länk till källan" type="url" value={value.url} onChange={set("url")} />
        <TextField id={`${idPrefix}-deadline`} label="Deadline" type="date" value={value.deadline} onChange={set("deadline")} />
        <TextField id={`${idPrefix}-min`} label="Belopp från (€)" inputMode="decimal" value={value.amount_min_eur} onChange={set("amount_min_eur")} />
        <TextField id={`${idPrefix}-max`} label="Belopp till (€)" inputMode="decimal" value={value.amount_max_eur} onChange={set("amount_max_eur")} />
        {showStatus && (
          <div className="admin-field">
            <label htmlFor={`${idPrefix}-status`}>Status</label>
            <select id={`${idPrefix}-status`} value={value.status} onChange={(e) => set("status")(e.target.value)}>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CALL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        <TextField id={`${idPrefix}-next`} label="Nästa steg" value={value.next_step} onChange={set("next_step")} />
        <TextField id={`${idPrefix}-nextdate`} label="Datum för nästa steg" type="date" value={value.next_step_date} onChange={set("next_step_date")} />
      </div>
      <TextArea id={`${idPrefix}-elig`} label="Vem får söka" value={value.eligibility} onChange={set("eligibility")} />
      <TextArea
        id={`${idPrefix}-req`}
        label="Krav och underlag"
        hint="Ett per rad, t.ex. « Statuts », « Budget prévisionnel », « Max 24 månader »"
        value={value.requirements}
        onChange={set("requirements")}
      />
      <TextArea id={`${idPrefix}-sum`} label="Sammanfattning" value={value.summary} onChange={set("summary")} />
      <TextArea id={`${idPrefix}-notes`} label="Anteckningar" value={value.notes} onChange={set("notes")} />
    </>
  );
}
