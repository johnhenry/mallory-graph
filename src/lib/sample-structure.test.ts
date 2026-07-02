import assert from "node:assert/strict";
import { test } from "node:test";
import { integersModuloStructure } from "./finite-structure.ts";
import { sampleStructureExpr } from "./sample-structure.ts";

test("samples every element of Z/7Z for a simple polynomial", () => {
  const points = sampleStructureExpr("x^2+1", integersModuloStructure(7));
  assert.equal(points.length, 7);
  assert.deepEqual(
    points.map((p) => p.y),
    [0, 1, 2, 3, 4, 5, 6].map((x) => (x * x + 1) % 7),
  );
});

test("substitutes param values for free variables alongside the axis variable", () => {
  const points = sampleStructureExpr("a*x", integersModuloStructure(5), "x", { a: 2 });
  assert.deepEqual(
    points.map((p) => p.y),
    [0, 1, 2, 3, 4].map((x) => (2 * x) % 5),
  );
});

test("skips elements where the expression is undefined (division by a non-invertible element)", () => {
  const points = sampleStructureExpr("1/x", integersModuloStructure(6), "x");
  // In Z/6Z only 1 and 5 are invertible; 0,2,3,4 have no reciprocal.
  assert.deepEqual(points.map((p) => p.x).sort(), [1, 5]);
});
