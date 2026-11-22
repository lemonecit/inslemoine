"use client";

import { useEffect, useRef, useState } from "react";
import { readPdf, type Reflowed } from "@/lib/pdf-reflow";
import { closeDialog, openDialog } from "@/lib/dialog";

type State =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "ready"; doc: Reflowed }
  | { phase: "empty" }
  | { phase: "error" };

type Props = { src: string; title: string; description: string };

export default function PdfReader({ src, title, description }: Props) {
  const [state, setState] = useState<State>({ phase: "closed" });
  const [size, setSize] = useState(1);
  const [status, setStatus] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cache = useRef<Reflowed | null>(null);

  const open = state.phase !== "closed";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog) openDialog(dialog);
  }, [open]);

  const start = async () => {
    setSize(1);
    if (cache.current) {
      setState({ phase: "ready", doc: cache.current });
      return;
    }
    setState({ phase: "loading" });
    setStatus("Chargement du document…");
    try {
      const doc = await readPdf(src, title);
      if (doc.charCount === 0) {
        setState({ phase: "empty" });
        setStatus("Ce document ne contient pas de texte lisible.");
        return;
      }
      cache.current = doc;
      setState({ phase: "ready", doc });
      setStatus(`Document prêt : ${doc.pageCount} pages.`);
    } catch {
      setState({ phase: "error" });
      setStatus("Le document n’a pas pu être lu.");
    }
  };

  const changeSize = (next: number) => {
    const value = Math.min(3, Math.max(1, next));
    setSize(value);
    setStatus(`Taille du texte : ${value} sur 3`);
  };

  return (
    <div className="pdf-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="pdf-actions">
        <button
          ref={triggerRef}
          type="button"
          className="button button-primary"
          aria-haspopup="dialog"
          onClick={start}
        >
          Ouvrir en lecture accessible
          <span className="visually-hidden"> : {title}</span>
        </button>
        <a href={src} download>
          Télécharger le PDF original
          <span className="visually-hidden"> : {title}</span>
        </a>
      </div>

      <dialog
        ref={dialogRef}
        className="reader"
        aria-labelledby="pdf-reader-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (dialogRef.current) closeDialog(dialogRef.current);
          }
        }}
        onClose={() => {
          setState({ phase: "closed" });
          triggerRef.current?.focus();
        }}
      >
        {open && (
          <>
            <div className="reader-bar">
              <button
                type="button"
                className="a11y-button"
                onClick={() => dialogRef.current && closeDialog(dialogRef.current)}
              >
                Fermer
              </button>
              <button
                type="button"
                className="a11y-button"
                onClick={() => changeSize(size - 1)}
              >
                Texte plus petit
              </button>
              <button
                type="button"
                className="a11y-button"
                onClick={() => changeSize(size + 1)}
              >
                Texte plus grand
              </button>
              <a className="reader-link" href={src} download>
                Télécharger le PDF original
              </a>
              <p role="status" className="visually-hidden">
                {status}
              </p>
            </div>
            <article className="reader-body" data-size={size}>
              <p className="eyebrow">
                Document PDF
                {state.phase === "ready" ? ` · ${state.doc.pageCount} pages` : ""}
              </p>
              <h2 id="pdf-reader-title">{title}</h2>

              {state.phase === "loading" && <p>Chargement du document…</p>}
              {state.phase === "empty" && (
                <p>
                  Ce document ne contient pas de texte lisible. Il s’agit
                  probablement d’un scan. Téléchargez le PDF original pour le
                  consulter.
                </p>
              )}
              {state.phase === "error" && (
                <p>
                  Le document n’a pas pu être lu. Téléchargez le PDF original
                  pour le consulter.
                </p>
              )}
              {state.phase === "ready" &&
                state.doc.blocks.map((block, index) => {
                  if (block.type === "heading") {
                    const Tag = `h${block.level}` as "h3" | "h4" | "h5";
                    return <Tag key={index}>{block.text}</Tag>;
                  }
                  if (block.type === "list") {
                    const List = block.ordered ? "ol" : "ul";
                    return (
                      <List key={index}>
                        {block.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </List>
                    );
                  }
                  return <p key={index}>{block.text}</p>;
                })}
            </article>
          </>
        )}
      </dialog>
    </div>
  );
}
