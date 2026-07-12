/**
 * URL-state schema for OdeSystemPanel -- a flat dump of its 11 free string
 * cells (see cell-ids.ts's cellIdsOdeSystem). Same shape/convention as
 * ode-state.ts: no construction-log/replay needed, plain user-editable
 * fields only.
 */
export interface OdeSystemStateV1 {
  v: 1;
  exprX: string;
  exprY: string;
  t0: string;
  x0: string;
  y0: string;
  tMin: string;
  tMax: string;
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
}

export type OdeSystemState = OdeSystemStateV1;

export const DEFAULT_ODE_SYSTEM_STATE: OdeSystemState = {
  v: 1,
  exprX: "x*(1-y)",
  exprY: "y*(x-1)",
  t0: "0",
  x0: "2",
  y0: "1",
  tMin: "0",
  tMax: "15",
  xMin: "0",
  xMax: "3",
  yMin: "0",
  yMax: "3",
};

export function encodeOdeSystemState(state: OdeSystemState): string {
  return base64UrlEncode(JSON.stringify(state));
}

/** Returns null on any malformed/unrecognized fragment rather than throwing. */
export function decodeOdeSystemState(fragment: string): OdeSystemState | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(fragment));
    return isOdeSystemStateV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isOdeSystemStateV1(value: unknown): value is OdeSystemStateV1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const fields = ["exprX", "exprY", "t0", "x0", "y0", "tMin", "tMax", "xMin", "xMax", "yMin", "yMax"] as const;
  return v.v === 1 && fields.every((f) => typeof v[f] === "string");
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
