"use client";

import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "#qui-sommes-nous", label: "Qui sommes-nous\u00a0?" },
  { href: "#nos-actions", label: "Nos actions" },
  { href: "#engagement", label: "Engagement" },
  { href: "#contact", label: "Contact", cta: true },
];

// Sur ordinateur la navigation est toujours visible ; sur mobile elle se replie
// derrière un bouton « Menu » (motif « disclosure », pas de rôle ARIA menu).
export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="site-nav"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (open && next instanceof Node && !rootRef.current?.contains(next)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="nav-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
        Menu
      </button>

      <nav
        id="nav-panel"
        className="nav-panel"
        data-open={open}
        aria-label="Navigation principale"
      >
        <ul className="nav-list">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                className={link.cta ? "nav-cta" : undefined}
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sans JavaScript le bouton ne fonctionnerait pas : on affiche alors la navigation. */}
      <noscript>
        <style>{`.nav-toggle{display:none}.site-nav .nav-panel{display:block}`}</style>
      </noscript>
    </div>
  );
}
