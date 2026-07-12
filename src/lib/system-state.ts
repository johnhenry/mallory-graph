/**
 * URL-state schema for SystemSolverPanel -- a flat dump of its 2 free cells
 * (see cell-ids.ts's cellIdsSystem): an ordered equation-string list (order
 * is significant -- rows are indexed by array position, not id) and a
 * comma-separated variable-name string. No construction-log/replay needed.
 */
export interface SystemStateV1 {
  v: 1;
  equations: string[];
  variables: string;
}

export type SystemState = SystemStateV1;

export const DEFAULT_SYSTEM_STATE: SystemState = {
  v: 1,
  equations: ["2*x + 3*y = 12", "x - y = 1"],
  variables: "x,y",
};

export function encodeSystemState(state: SystemState): string {
  return base64UrlEncode(JSON.stringify(state));
}

/** Returns null on any malformed/unrecognized fragment rather than throwing. */
export function decodeSystemState(fragment: string): SystemState | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(fragment));
    return isSystemStateV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isSystemStateV1(value: unknown): value is SystemStateV1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || typeof v.variables !== "string" || !Array.isArray(v.equations)) return false;
  return v.equations.every((e) => typeof e === "string");
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
