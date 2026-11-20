import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type Block =
  | { type: "heading"; level: 3 | 4 | 5; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export type Reflowed = { blocks: Block[]; pageCount: number; charCount: number };

type Line = { text: string; size: number; x: number; y: number; page: number };

const BULLET = /^[•·▪◦●■\-–—*]\s+(.*)$/;
const NUMBERED = /^(?:\d{1,2}|[a-zA-Z])[.)]\s+(.*)$/;
const SENTENCE_END = /[.!?:;…»”)]$/;

function extractLines(items: TextItem[], page: number, pageHeight: number): Line[] {
  const lines: Line[] = [];
  let current: (Line & { end: number }) | null = null;

  for (const item of items) {
    const size = Math.hypot(item.transform[2], item.transform[3]);
    const x = item.transform[4];
    const y = item.transform[5];
    const newLine =
      !current || Math.abs(y - current.y) > Math.max(size, current.size) * 0.4;

    if (newLine) {
      if (current) lines.push(current);
      current = { text: item.str, size, x, y, page, end: x + item.width };
    } else if (current) {
      const gap = x - current.end;
      const needsSpace =
        gap > size * 0.15 && !current.text.endsWith(" ") && !item.str.startsWith(" ");
      current.text += (needsSpace ? " " : "") + item.str;
      current.size = Math.max(current.size, size);
      current.end = x + item.width;
    }
    if (current && item.hasEOL) {
      lines.push(current);
      current = null;
    }
  }
  if (current) lines.push(current);

  return lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
    .filter((line) => line.text)
    .filter((line) => {
      // Numéros de page isolés en haut ou en bas de page.
      const isPageNumber = /^(?:page\s*)?\d{1,3}(?:\s*\/\s*\d{1,3})?$/i.test(line.text);
      const atEdge = line.y < pageHeight * 0.08 || line.y > pageHeight * 0.92;
      return !(isPageNumber && atEdge);
    });
}

function bodySize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.size * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + line.text.length);
  }
  let best = 12;
  let max = 0;
  for (const [size, total] of weight) {
    if (total > max) {
      max = total;
      best = size;
    }
  }
  return best;
}

function join(previous: string, next: string): string {
  if (previous.endsWith("-") && /^\p{Ll}/u.test(next)) return previous.slice(0, -1) + next;
  return `${previous} ${next}`;
}

export function reflow(lines: Line[], pageCount: number): Reflowed {
  const body = bodySize(lines);
  const headingSizes = [
    ...new Set(
      lines.filter((l) => l.size >= body * 1.15 && l.text.length <= 160).map((l) => l.size),
    ),
  ].sort((a, b) => b - a);
  const levelOf = (size: number) =>
    Math.min(5, 3 + headingSizes.findIndex((s) => Math.abs(s - size) < 0.6)) as 3 | 4 | 5;

  const blocks: Block[] = [];
  let previous: Line | null = null;
  let charCount = 0;

  for (const line of lines) {
    charCount += line.text.length;
    const sameFlow = previous && previous.page === line.page;
    const gap = sameFlow && previous ? previous.y - line.y : Infinity;
    const tight = gap <= line.size * 1.6;
    const last = blocks[blocks.length - 1];
    const isHeading = line.size >= body * 1.15 && line.text.length <= 160;

    if (isHeading) {
      const level = levelOf(line.size);
      if (last?.type === "heading" && last.level === level && tight) {
        last.text = join(last.text, line.text);
      } else {
        blocks.push({ type: "heading", level, text: line.text });
      }
    } else {
      const bullet = BULLET.exec(line.text);
      const numbered = bullet ? null : NUMBERED.exec(line.text);
      const marker = bullet ?? numbered;

      if (marker) {
        const ordered = Boolean(numbered);
        const continuesList =
          last?.type === "list" && last.ordered === ordered && (!sameFlow || gap <= line.size * 3);
        if (last?.type === "list" && continuesList) {
          last.items.push(marker[1]);
        } else {
          blocks.push({ type: "list", ordered, items: [marker[1]] });
        }
      } else if (last?.type === "list" && tight && previous && line.x >= previous.x - 1) {
        last.items[last.items.length - 1] = join(last.items[last.items.length - 1], line.text);
      } else if (
        last?.type === "paragraph" &&
        (tight || (!sameFlow && !SENTENCE_END.test(last.text)))
      ) {
        last.text = join(last.text, line.text);
      } else {
        blocks.push({ type: "paragraph", text: line.text });
      }
    }
    previous = line;
  }

  return { blocks, pageCount, charCount };
}

const normalize = (text: string) =>
  text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// La page affiche déjà le titre du document en h2 : on retire sa copie dans le PDF
// et on remonte les niveaux restants pour qu'ils suivent directement ce h2.
export function prepare(blocks: Block[], title: string): Block[] {
  const [first, ...rest] = blocks;
  const result =
    first?.type === "heading" && normalize(first.text) === normalize(title) ? rest : blocks;
  const levels = result.flatMap((b) => (b.type === "heading" ? [b.level] : []));
  if (levels.length === 0) return result;
  const shift = Math.min(...levels) - 3;
  return result.map((b) =>
    b.type === "heading" ? { ...b, level: (b.level - shift) as 3 | 4 | 5 } : b,
  );
}

export async function readPdf(src: string, title: string): Promise<Reflowed> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ url: src });
  const pdf: PDFDocumentProxy = await task.promise;
  const lines: Line[] = [];
  try {
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is TextItem => "str" in item);
      lines.push(...extractLines(items, number, page.view[3]));
    }
    const reflowed = reflow(lines, pdf.numPages);
    return { ...reflowed, blocks: prepare(reflowed.blocks, title) };
  } finally {
    await task.destroy();
  }
}
