/**
 * URL-state schema for mallory-graph — the graph's source of truth,
 * serialized into a compact base64url fragment (Desmos-style: no server
 * round-trip). Designed now, in Phase 1, even though full support (sliders,
 * multi-cell graphs, style) lands in later phases and round-trip UI wiring
 * ships in Phase 8 — extending a versioned schema is far cheaper than
 * retrofitting one once cells/sliders/viewport state already exist.
 */
export interface GraphStateV1 {
  v: 1;
  /** Ordered list of expression cells, each compiled via Symbolic. */
  cells: Array<{ id: string; source: string }>;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface GraphStateV2 {
  v: 2;
  /** Ordered list of expression cells, each compiled via Symbolic. */
  cells: Array<{ id: string; source: string }>;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Current value of every auto-inferred slider, keyed by variable name. */
  params: Record<string, number>;
  /** Structure selector: a modulus for Z/nZ, or null for the real numbers. */
  structureModulus: number | null;
  /** Arithmetic mode for the y-readout. */
  mode: "float" | "exact";
}

export type GraphState = GraphStateV2;

export const DEFAULT_GRAPH_STATE: GraphState = {
  v: 2,
  cells: [{ id: "f", source: "x^2" }],
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 100 },
  params: {},
  structureModulus: null,
  mode: "float",
};

export function encodeGraphState(state: GraphState): string {
  return base64UrlEncode(JSON.stringify(state));
}

/** Returns null on any malformed/unrecognized fragment rather than throwing. Upgrades a v1 payload (no params/structure/mode) to v2 with defaults. */
export function decodeGraphState(fragment: string): GraphState | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(fragment));
    if (isGraphStateV2(parsed)) return parsed;
    if (isGraphStateV1(parsed)) {
      return { ...parsed, v: 2, params: {}, structureModulus: null, mode: "float" };
    }
    return null;
  } catch {
    return null;
  }
}

function hasCellsAndViewport(v: Record<string, unknown>): boolean {
  return (
    Array.isArray(v.cells) &&
    v.cells.every((c) => typeof c === "object" && c !== null && typeof (c as { id?: unknown }).id === "string" && typeof (c as { source?: unknown }).source === "string") &&
    typeof v.viewport === "object" &&
    v.viewport !== null
  );
}

function isGraphStateV1(value: unknown): value is GraphStateV1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.v === 1 && hasCellsAndViewport(v);
}

function isGraphStateV2(value: unknown): value is GraphStateV2 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === 2 &&
    hasCellsAndViewport(v) &&
    typeof v.params === "object" &&
    v.params !== null &&
    (v.structureModulus === null || typeof v.structureModulus === "number") &&
    (v.mode === "float" || v.mode === "exact")
  );
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
