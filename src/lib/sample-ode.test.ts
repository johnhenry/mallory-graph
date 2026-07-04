import assert from "node:assert/strict";
import { test } from "node:test";
import {
  odeSystemTrajectoryToPhasePath,
  sampleOdeSolution,
  sampleOdeSystem2D,
  sampleSlopeField,
  sampleVectorField2D,
  type OdeSystemSpec,
} from "./sample-ode.ts";

const DECAY_SPEC: OdeSystemSpec = { stateVars: ["x", "y"], independentVar: "t", derivatives: ["-x", "-2*y"] };
const ROTATION_SPEC: OdeSystemSpec = { stateVars: ["x", "y"], independentVar: "t", derivatives: ["-y", "x"] };

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

test("sampleOdeSystem2D matches the known closed-form solution for dx/dt=-x, dy/dt=-2y (x(0)=1,y(0)=1 -> x=e^-t, y=e^-2t)", () => {
  const trajectory = sampleOdeSystem2D(DECAY_SPEC, { t0: 0, state0: [1, 1] }, { min: 0, max: 2 });
  const last = trajectory[trajectory.length - 1];
  assert.ok(last);
  assert.ok(Math.abs(last.t - 2) < 1e-9);
  assert.ok(Math.abs(last.state[0] - Math.exp(-2)) < 1e-3);
  assert.ok(Math.abs(last.state[1] - Math.exp(-4)) < 1e-3);
});

test("sampleOdeSystem2D includes the initial condition itself as a point, even when t0 is in the interior of the domain", () => {
  const trajectory = sampleOdeSystem2D(DECAY_SPEC, { t0: 0, state0: [3, 5] }, { min: -1, max: 1 });
  assert.ok(
    trajectory.some((p) => Math.abs(p.t) < 1e-9 && Math.abs(p.state[0] - 3) < 1e-9 && Math.abs(p.state[1] - 5) < 1e-9),
  );
});

test("sampleOdeSystem2D still includes the initial condition when the domain is entirely on one side of t0 (degenerate forward run)", () => {
  // t0 = tDomain.max -- forward run is empty, so the seed can only come from the explicit splice, not from either run.
  const trajectory = sampleOdeSystem2D(DECAY_SPEC, { t0: 5, state0: [2, 2] }, { min: 0, max: 5 });
  assert.ok(trajectory.length > 1);
  const last = trajectory[trajectory.length - 1];
  assert.ok(last);
  assert.ok(Math.abs(last.t - 5) < 1e-9);
  assert.ok(Math.abs(last.state[0] - 2) < 1e-9 && Math.abs(last.state[1] - 2) < 1e-9);
  const first = trajectory[0];
  assert.ok(first);
  assert.ok(Math.abs(first.t - 0) < 1e-6);
});

test("sampleOdeSystem2D truncates a run when the solution diverges to non-finite rather than propagating NaN forever", () => {
  // dx/dt = x^2, dy/dt = 0, x(0) = 1 blows up at t = 1 (x = 1/(1-t))
  const spec: OdeSystemSpec = { stateVars: ["x", "y"], independentVar: "t", derivatives: ["x^2", "0"] };
  const trajectory = sampleOdeSystem2D(spec, { t0: 0, state0: [1, 0] }, { min: 0, max: 5 }, 500);
  for (const p of trajectory) {
    assert.ok(Number.isFinite(p.t));
    assert.ok(Number.isFinite(p.state[0]));
    assert.ok(Number.isFinite(p.state[1]));
  }
});

test("odeSystemTrajectoryToPhasePath drops t and plots state[0] vs state[1]", () => {
  const trajectory = sampleOdeSystem2D(DECAY_SPEC, { t0: 0, state0: [1, 1] }, { min: 0, max: 1 }, 50);
  const path = odeSystemTrajectoryToPhasePath(trajectory);
  assert.ok(path.commands.length > 0);
  const first = path.commands[0];
  assert.ok(first);
  assert.ok(Math.abs(first.x - 1) < 1e-9 && Math.abs(first.y - 1) < 1e-9);
});

test("sampleVectorField2D samples the exact (dx,dy) at every grid point for a well-defined field", () => {
  const points = sampleVectorField2D(ROTATION_SPEC, { min: -2, max: 2 }, { min: -2, max: 2 }, 0, 5);
  assert.equal(points.length, 25);
  for (const p of points) {
    assert.ok(Math.abs(p.dx - -p.y) < 1e-9);
    assert.ok(Math.abs(p.dy - p.x) < 1e-9);
  }
});

test("sampleVectorField2D omits points where the field is undefined", () => {
  const spec: OdeSystemSpec = { stateVars: ["x", "y"], independentVar: "t", derivatives: ["1/x", "1"] };
  // Centered grid so x=0 lands exactly on a grid point.
  const points = sampleVectorField2D(spec, { min: -2, max: 2 }, { min: -2, max: 2 }, 0, 5);
  assert.ok(points.length < 25);
  for (const p of points) {
    assert.ok(p.x !== 0);
  }
});
