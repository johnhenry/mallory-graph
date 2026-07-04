import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleParametricCurve, samplePolarCurve } from "./sample-parametric.ts";

test("samples a parametric circle (cos(t), sin(t))", () => {
  const path = sampleParametricCurve("cos(t)", "sin(t)", { min: 0, max: 2 * Math.PI }, 100);
  assert.ok(path.commands.length > 0);
  for (const c of path.commands) {
    assert.ok(Math.abs(Math.hypot(c.x, c.y) - 1) < 1e-9);
  }
});

test("breaks into separate runs at a non-finite sample", () => {
  // resolution 3 over [-1,1] samples exactly at t=-1,0,1 -- 1/t is a genuine division by zero at t=0.
  const path = sampleParametricCurve("cos(t)", "1/t", { min: -1, max: 1 }, 3);
  const moveTos = path.commands.filter((c) => c.op === "moveTo");
  assert.equal(moveTos.length, 2);
  assert.ok(path.commands.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y)));
});

test("samplePolarCurve traces a circle r=2 as x=2cos(t), y=2sin(t)", () => {
  const path = samplePolarCurve("2", { min: 0, max: 2 * Math.PI }, 50);
  for (const c of path.commands) {
    assert.ok(Math.abs(Math.hypot(c.x, c.y) - 2) < 1e-9);
  }
});

test("samplePolarCurve traces a cardioid r=1+cos(theta) matching the analytic value", () => {
  const path = samplePolarCurve("1+cos(t)", { min: 0, max: 2 * Math.PI }, 60);
  const first = path.commands[0];
  assert.ok(first);
  // At theta=0, r=2 -> (2,0)
  assert.ok(Math.abs(first.x - 2) < 1e-6);
  assert.ok(Math.abs(first.y - 0) < 1e-6);
});
