import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleOdeSolution, sampleSlopeField } from "./sample-ode.ts";

test("sampleOdeSolution matches the known closed-form solution for dy/dx = y (y(0)=1 -> y=e^x)", () => {
  const path = sampleOdeSolution("y", 0, 1, { min: -1, max: 1 }, 400);
  const byX = new Map(path.commands.map((c) => [Math.round(c.x * 100) / 100, c.y]));
  const y1 = byX.get(1);
  assert.ok(y1 !== undefined);
  assert.ok(Math.abs((y1 as number) - Math.E) < 1e-3);
  const yNeg1 = byX.get(-1);
  assert.ok(yNeg1 !== undefined);
  assert.ok(Math.abs((yNeg1 as number) - 1 / Math.E) < 1e-3);
});

test("sampleOdeSolution matches the known closed-form solution for dy/dx = -y (y(0)=2 -> y=2e^-x)", () => {
  const path = sampleOdeSolution("-y", 0, 2, { min: 0, max: 2 }, 400);
  const last = path.commands[path.commands.length - 1];
  assert.ok(last);
  assert.ok(Math.abs(last.x - 2) < 1e-9);
  assert.ok(Math.abs(last.y - 2 * Math.exp(-2)) < 1e-3);
});

test("sampleOdeSolution includes the initial condition itself as a point", () => {
  const path = sampleOdeSolution("x - y", 0, 1, { min: -2, max: 2 });
  assert.ok(path.commands.some((c) => Math.abs(c.x) < 1e-9 && Math.abs(c.y - 1) < 1e-9));
});

test("sampleOdeSolution truncates a run when the solution diverges to non-finite rather than propagating NaN forever", () => {
  // dy/dx = y^2, y(0) = 1 blows up at x = 1 (y = 1/(1-x))
  const path = sampleOdeSolution("y^2", 0, 1, { min: 0, max: 5 }, 500);
  for (const cmd of path.commands) {
    assert.ok(Number.isFinite(cmd.x));
    assert.ok(Number.isFinite(cmd.y));
  }
});

test("sampleOdeSolution handles a domain entirely on one side of x0", () => {
  const path = sampleOdeSolution("y", 5, 1, { min: 0, max: 5 });
  assert.ok(path.commands.length > 1);
  const first = path.commands[0];
  assert.ok(first);
  assert.ok(Math.abs(first.x - 0) < 1e-6);
});

test("sampleSlopeField samples a finite slope at every grid point for a well-defined vector field", () => {
  const points = sampleSlopeField("x - y", { min: -2, max: 2 }, { min: -2, max: 2 }, 5);
  assert.equal(points.length, 25);
  for (const p of points) {
    assert.ok(Number.isFinite(p.slope));
    assert.ok(Math.abs(p.slope - (p.x - p.y)) < 1e-9);
  }
});

test("sampleSlopeField omits points where the field is undefined", () => {
  // 1/(x*y) is undefined along both axes -- the grid below is centered so x=0/y=0 land exactly on grid points.
  const points = sampleSlopeField("1/(x*y)", { min: -2, max: 2 }, { min: -2, max: 2 }, 5);
  assert.ok(points.length < 25);
  for (const p of points) {
    assert.ok(p.x !== 0 && p.y !== 0);
  }
});
