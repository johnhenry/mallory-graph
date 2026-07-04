import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MULTI_GRAPH_STATE, decodeMultiGraphState, encodeMultiGraphState } from "./multi-graph-state.ts";

test("round-trips the default multi-graph state through encode/decode", () => {
  const fragment = encodeMultiGraphState(DEFAULT_MULTI_GRAPH_STATE);
  assert.deepEqual(decodeMultiGraphState(fragment), DEFAULT_MULTI_GRAPH_STATE);
});

test("round-trips per-row params and unicode expression sources", () => {
  const state = {
    v: 1 as const,
    rows: [{ source: "a*sin(θ) + π", color: 0x16a34a, visible: false, params: { a: 2.5 } }],
    viewport: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
  };
  const fragment = encodeMultiGraphState(state);
  assert.deepEqual(decodeMultiGraphState(fragment), state);
});

test("encoded fragment is URL-fragment-safe (no +, /, or = padding)", () => {
  const fragment = encodeMultiGraphState(DEFAULT_MULTI_GRAPH_STATE);
  assert.ok(!/[+/=]/.test(fragment), `fragment contains unsafe characters: ${fragment}`);
});

test("decodeMultiGraphState returns null for garbage input rather than throwing", () => {
  assert.equal(decodeMultiGraphState("not-valid-base64url-json!!!"), null);
  assert.equal(decodeMultiGraphState(""), null);
});

test("decodeMultiGraphState rejects a well-formed but wrong-shape payload", () => {
  const badFragment = encodeMultiGraphState as unknown as (s: unknown) => string;
  const fragment = badFragment({ v: 1, rows: "not-an-array", viewport: {} });
  assert.equal(decodeMultiGraphState(fragment), null);
});
