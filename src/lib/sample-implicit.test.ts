import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleImplicitCurve } from "./sample-implicit.ts";

test("traces a circle x^2+y^2=4 -- every segment endpoint lies close to radius 2", () => {
  const segments = sampleImplicitCurve("x^2+y^2=4", { min: -3, max: 3 }, { min: -3, max: 3 }, 60);
  assert.ok(segments.length > 0);
  for (const s of segments) {
    const r1 = Math.hypot(s.x1, s.y1);
    const r2 = Math.hypot(s.x2, s.y2);
    assert.ok(Math.abs(r1 - 2) < 0.15, `endpoint (${s.x1},${s.y1}) at radius ${r1}`);
    assert.ok(Math.abs(r2 - 2) < 0.15, `endpoint (${s.x2},${s.y2}) at radius ${r2}`);
  }
});

test("a domain entirely outside the circle produces no segments", () => {
  const segments = sampleImplicitCurve("x^2+y^2=4", { min: 10, max: 12 }, { min: 10, max: 12 }, 20);
  assert.equal(segments.length, 0);
});

test("traces a bare implicitly-zero expression the same as its explicit '=0' form", () => {
  const bare = sampleImplicitCurve("x^2+y^2-4", { min: -3, max: 3 }, { min: -3, max: 3 }, 60);
  const explicit = sampleImplicitCurve("x^2+y^2-4=0", { min: -3, max: 3 }, { min: -3, max: 3 }, 60);
  assert.equal(bare.length, explicit.length);
});

test("traces a vertical line x=1 correctly (a relation using only one variable)", () => {
  const segments = sampleImplicitCurve("x=1", { min: -2, max: 2 }, { min: -2, max: 2 }, 20);
  assert.ok(segments.length > 0);
  for (const s of segments) {
    assert.ok(Math.abs(s.x1 - 1) < 0.3);
    assert.ok(Math.abs(s.x2 - 1) < 0.3);
  }
});
