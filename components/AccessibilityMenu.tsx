"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  parsePrefs,
  resetPrefs,
  setPref,
  subscribe,
  type Prefs,
} from "@/lib/a11y-prefs";

type Group = {
  key: keyof Prefs;
  legend: string;
  hint?: string;
  options: { value: string; label: string }[];
};

const GROUPS: Group[] = [
  {
    key: "magnifier",
    legend: "Loupe au clavier",
    hint: "Agrandit chaque élément atteint avec la touche Tab et propose la lecture en grand des textes.",
    options: [
      { value: "default", label: "Désactivée" },
      { value: "on", label: "Activée" },
    ],
  },
  {
    key: "textSize",
    legend: "Taille du texte",
    options: [
      { value: "default", label: "Standard" },
      { value: "large", label: "Grand" },
      { value: "xlarge", label: "Très grand" },
    ],
  },
  {
    key: "contrast",
    legend: "Contraste des couleurs",
    options: [
      { value: "default", label: "Standard" },
      { value: "high", label: "Noir sur blanc" },
      { value: "dark", label: "Jaune sur noir" },
    ],
  },
  {
    key: "spacing",
    legend: "Espacement du texte",
    options: [
      { value: "default", label: "Standard" },
      { value: "wide", label: "Élargi" },
    ],
  },
  {
    key: "font",
    legend: "Police de caractères",
    options: [
      { value: "default", label: "Standard" },
      { value: "lexend", label: "Lecture facilitée" },
    ],
  },
  {
    key: "motion",
    legend: "Animations",
    options: [
      { value: "default", label: "Standard" },
      { value: "reduced", label: "Réduites" },
    ],
  },
];

export default function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prefs = parsePrefs(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="a11y-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="a11y-toggle"
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="4.5" r="1.75" />
          <path d="M5 8.5l7 1.5 7-1.5" />
          <path d="M12 10v4.5" />
          <path d="M8.5 21l3.5-6.5 3.5 6.5" />
        </svg>
        Accessibilité
      </button>

      <div
        id="a11y-panel"
        className="a11y-panel"
        role="group"
        aria-labelledby="a11y-title"
        hidden={!open}
      >
        <p id="a11y-title" className="a11y-title">
          Options d&rsquo;affichage
        </p>

        {GROUPS.map((group) => (
          <fieldset
            key={group.key}
            className="a11y-group"
            aria-describedby={group.hint ? `a11y-hint-${group.key}` : undefined}
          >
            <legend>{group.legend}</legend>
            {group.hint && (
              <p id={`a11y-hint-${group.key}`} className="a11y-hint">
                {group.hint}
              </p>
            )}
            <div className="a11y-choices">
              {group.options.map((option) => (
                <label key={option.value} className="choice">
                  <input
                    type="radio"
                    className="choice-input"
                    name={`a11y-${group.key}`}
                    value={option.value}
                    checked={prefs[group.key] === option.value}
                    onChange={() => {
                      setPref(group.key, option.value);
                      setStatus(`${group.legend} : ${option.label}`);
                    }}
                  />
                  <span className="choice-label">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="a11y-actions">
          <button
            type="button"
            className="a11y-button"
            onClick={() => {
              resetPrefs();
              setStatus("Options d’affichage réinitialisées");
            }}
          >
            Réinitialiser
          </button>
          <button type="button" className="a11y-button" onClick={close}>
            Fermer
          </button>
        </div>

        <p role="status" className="visually-hidden">
          {status}
        </p>
      </div>
    </div>
  );
}
