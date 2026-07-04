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

test("resolves the ambiguous saddle case via the asymptotic decider, not always the fixed default pairing", () => {
  // Bilinear field 2xy+1=0 (xy=-0.5): branches lie near the top-left and
  // bottom-right corners of the [-1,1]x[-1,1] cell -- the correct pairing
  // connects left-top and bottom-right, not the fixed default (left-bottom,
  // right-top), which would instead draw two long diagonals crossing through
  // the cell's middle. A single cell (resolution=2) makes the corner values,
  // and so this decision, fully deterministic -- verified exactly, not just
  // approximately, since edge interpolation is exact for a bilinear field.
  const segments = sampleImplicitCurve("2*x*y+1", { min: -1, max: 1 }, { min: -1, max: 1 }, 2);
  assert.equal(segments.length, 2);
  for (const s of segments) {
    assert.ok(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 1.2, "segment should hug a corner, not cross the cell diagonally");
  }
  const nearTopLeft = segments.some((s) => s.x1 < 0 && s.y1 > 0 && s.x2 < 0 && s.y2 > 0);
  const nearBottomRight = segments.some((s) => s.x1 > 0 && s.y1 < 0 && s.x2 > 0 && s.y2 < 0);
  assert.ok(nearTopLeft, "expected a segment isolating the top-left corner");
  assert.ok(nearBottomRight, "expected a segment isolating the bottom-right corner");
});

test("keeps the default saddle pairing when the asymptotic decider agrees with it", () => {
  // Bilinear field 2xy-1=0 (xy=0.5): branches lie near the bottom-left and
  // top-right corners -- exactly the fixed default pairing (left-bottom,
  // right-top), so the decider should not swap here.
  const segments = sampleImplicitCurve("2*x*y-1", { min: -1, max: 1 }, { min: -1, max: 1 }, 2);
  assert.equal(segments.length, 2);
  const nearBottomLeft = segments.some((s) => s.x1 < 0 && s.y1 < 0 && s.x2 < 0 && s.y2 < 0);
  const nearTopRight = segments.some((s) => s.x1 > 0 && s.y1 > 0 && s.x2 > 0 && s.y2 > 0);
  assert.ok(nearBottomLeft, "expected a segment isolating the bottom-left corner");
  assert.ok(nearTopRight, "expected a segment isolating the top-right corner");
});
