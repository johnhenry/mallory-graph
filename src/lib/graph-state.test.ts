import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_GRAPH_STATE, decodeGraphState, encodeGraphState } from "./graph-state.ts";

test("round-trips the default graph state through encode/decode", () => {
  const fragment = encodeGraphState(DEFAULT_GRAPH_STATE);
  assert.deepEqual(decodeGraphState(fragment), DEFAULT_GRAPH_STATE);
});

test("round-trips unicode expression sources", () => {
  const state = { ...DEFAULT_GRAPH_STATE, cells: [{ id: "f", source: "sin(θ) + π" }] };
  const fragment = encodeGraphState(state);
  assert.deepEqual(decodeGraphState(fragment), state);
});

test("encoded fragment is URL-fragment-safe (no +, /, or = padding)", () => {
  const fragment = encodeGraphState(DEFAULT_GRAPH_STATE);
  assert.ok(!/[+/=]/.test(fragment), `fragment contains unsafe characters: ${fragment}`);
});

test("decode returns null for malformed input instead of throwing", () => {
  assert.equal(decodeGraphState("not-valid-base64!!"), null);
  assert.equal(decodeGraphState(""), null);
});

test("decode rejects a differently-shaped payload", () => {
  const notAGraphState = btoa(JSON.stringify({ hello: "world" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  assert.equal(decodeGraphState(notAGraphState), null);
});

test("round-trips params, structureModulus, and mode", () => {
  const state = {
    ...DEFAULT_GRAPH_STATE,
    cells: [{ id: "f", source: "a*x^2+b" }],
    params: { a: 2, b: -1 },
    structureModulus: 7,
    mode: "exact" as const,
  };
  const fragment = encodeGraphState(state);
  assert.deepEqual(decodeGraphState(fragment), state);
});

test("upgrades a v1 fragment (no params/structureModulus/mode) to v2 defaults", () => {
  const v1 = { v: 1, cells: [{ id: "f", source: "x^2" }], viewport: DEFAULT_GRAPH_STATE.viewport };
  const fragment = btoa(JSON.stringify(v1))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  assert.deepEqual(decodeGraphState(fragment), {
    v: 2,
    cells: v1.cells,
    viewport: v1.viewport,
    params: {},
    structureModulus: null,
    mode: "float",
  });
});
