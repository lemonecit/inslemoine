"use client";

import { useState, type ReactNode } from "react";
import { ISO_CLASSES } from "@/lib/admin/iso9999";

export function IsoSelect({
  id,
  label,
  value,
  onChange,
  allLabel = "Alla klasser",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {ISO_CLASSES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} – {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}

// Meddelanden läses upp av skärmläsare (role="status"/"alert") utan att flytta fokus.
export function Notice({ kind, children }: { kind: "info" | "error"; children: ReactNode }) {
  return (
    <p className={`admin-notice admin-notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

// Ändrande knapp med bekräftelse i två steg (ingen blockerande dialogruta).
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="button button-outline admin-danger" onClick={() => setAsking(true)} disabled={disabled}>
        {label}
      </button>
    );
  }
  return (
    <span className="admin-confirm" role="group" aria-label="Bekräfta">
      <button type="button" className="button button-danger" onClick={onConfirm} autoFocus>
        {confirmLabel}
      </button>
      <button type="button" className="button button-outline" onClick={() => setAsking(false)}>
        Avbryt
      </button>
    </span>
  );
}

export function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span aria-hidden="true">{"●".repeat(value)}{"○".repeat(5 - value)}</span>
      <span className="visually-hidden">
        {label}: {value} av 5
      </span>
    </span>
  );
}
