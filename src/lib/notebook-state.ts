/**
 * URL-state schema for NotebookPanel, parallel to multi-graph-state.ts's
 * schema for GraphCanvasMulti (not layered onto either's own lineage, since
 * a notebook document -- an ordered mix of text/graph/value blocks -- is a
 * genuinely different shape from a single row list). Same base64url-in-the-
 * hash convention: no server round-trip, Desmos-style. Duplicates its own
 * tiny base64url helpers rather than sharing them with multi-graph-state.ts,
 * matching that file's own choice not to factor them out either.
 */
export interface NotebookGraphBlockStateV1 {
  type: "graph";
  rows: Array<{ source: string; color: number; visible: boolean; params: Record<string, number> }>;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export type NotebookBlockStateV1 =
  | { type: "text"; content: string }
  | NotebookGraphBlockStateV1
  | { type: "value"; name: string; value: number };

export interface NotebookStateV1 {
  v: 1;
  blocks: NotebookBlockStateV1[];
}

export type NotebookState = NotebookStateV1;

export const DEFAULT_NOTEBOOK_STATE: NotebookState = {
  v: 1,
  blocks: [
    {
      type: "text",
      content:
        "A reactive notebook: mix free-form notes with live graph cells and named value cells. Every graph cell below shares one CellGraph, so a graph cell's expression can reference an earlier value cell by name -- e.g. a value block named \"k\" makes \"k\" available to any graph cell below it, sourced live instead of getting its own independent slider. Referencing another graph cell's entire curve (not just a named scalar) is a later extension.",
    },
    {
      type: "graph",
      rows: [{ source: "sin(x)", color: 0x2563eb, visible: true, params: {} }],
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    },
  ],
};

export function encodeNotebookState(state: NotebookState): string {
  return base64UrlEncode(JSON.stringify(state));
}

/** Returns null on any malformed/unrecognized fragment rather than throwing. */
export function decodeNotebookState(fragment: string): NotebookState | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(fragment));
    return isNotebookStateV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isNotebookStateV1(value: unknown): value is NotebookStateV1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || !Array.isArray(v.blocks)) return false;
  return v.blocks.every(isNotebookBlockStateV1);
}

function isNotebookBlockStateV1(value: unknown): value is NotebookBlockStateV1 {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (b.type === "text") return typeof b.content === "string";
  if (b.type === "value") return typeof b.name === "string" && typeof b.value === "number";
  if (b.type === "graph") {
    if (typeof b.viewport !== "object" || b.viewport === null || !Array.isArray(b.rows)) return false;
    return b.rows.every((r) => {
      if (typeof r !== "object" || r === null) return false;
      const row = r as Record<string, unknown>;
      return (
        typeof row.source === "string" &&
        typeof row.color === "number" &&
        typeof row.visible === "boolean" &&
        typeof row.params === "object" &&
        row.params !== null
      );
    });
  }
  return false;
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
