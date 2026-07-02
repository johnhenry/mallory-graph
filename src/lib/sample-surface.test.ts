import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleSurface } from "./sample-surface.ts";

test("every sampled mesh vertex satisfies z = x + y for a plane", () => {
  const meshes = sampleSurface("x+y", { min: -2, max: 2 }, { min: -2, max: 2 }, 4);
  assert.ok(meshes.length > 0);
  for (const mesh of meshes) {
    assert.ok(mesh.faces.length > 0);
    for (const face of mesh.faces) {
      assert.equal(face.length, 3);
      for (const vertex of face) {
        assert.ok(Math.abs(vertex.z - (vertex.x + vertex.y)) < 1e-9);
      }
    }
  }
});

test("substitutes param values for free variables alongside both axis variables", () => {
  const meshes = sampleSurface("a*x*y", { min: -1, max: 1 }, { min: -1, max: 1 }, 3, { a: 2 });
  for (const mesh of meshes) {
    for (const face of mesh.faces) {
      for (const vertex of face) {
        assert.ok(Math.abs(vertex.z - 2 * vertex.x * vertex.y) < 1e-9);
      }
    }
  }
});

test("a finer resolution samples more faces than a coarser one", () => {
  const coarse = sampleSurface("x^2+y^2", { min: -1, max: 1 }, { min: -1, max: 1 }, 2);
  const fine = sampleSurface("x^2+y^2", { min: -1, max: 1 }, { min: -1, max: 1 }, 8);
  const coarseFaces = coarse.reduce((n, m) => n + m.faces.length, 0);
  const fineFaces = fine.reduce((n, m) => n + m.faces.length, 0);
  assert.ok(fineFaces > coarseFaces);
});
