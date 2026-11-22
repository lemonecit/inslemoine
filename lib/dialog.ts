// Öppnar och stänger <dialog> även i webbläsare utan inbyggt stöd (t.ex. Safari före 15.4, Firefox före 98,
// äldre Chrome). Där är <dialog> ett okänt element: showModal() och close() finns inte, och elementet
// syns som vanlig text. Reservläget sätter attributet « open » själv, flyttar fokus in i fönstret och
// skickar « close »-händelsen så att samma kod som i moderna webbläsare tar hand om fokus tillbaka.
// Stilen för reservläget (helskärm) finns i globals.css under dialog[data-fallback].

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openDialog(dialog: HTMLDialogElement): void {
  if (dialog.hasAttribute("open")) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
  dialog.setAttribute("data-fallback", "");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
}

export function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }
  if (!dialog.hasAttribute("open")) return;
  dialog.removeAttribute("open");
  dialog.removeAttribute("data-fallback");
  dialog.dispatchEvent(new Event("close"));
}
