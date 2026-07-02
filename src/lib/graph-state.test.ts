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
