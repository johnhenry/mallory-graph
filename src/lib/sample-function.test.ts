import assert from "node:assert/strict";
import { test } from "node:test";
import { Symbolic } from "mallory-math";
import { sampleExpr, sampleExprAdaptive, sampleRegionMask } from "./sample-function.ts";

test("samples a plain function of x with no params", () => {
  const path = sampleExpr("x^2", { min: -2, max: 2 }, 5);
  assert.equal(path.commands.length, 5);
});

test("substitutes param values for free variables alongside the axis variable", () => {
  const path = sampleExpr("a*x^2+b", { min: 0, max: 0 }, 2, "x", { a: 2, b: 3 });
  const [command] = path.commands;
  assert.ok(command);
  assert.equal(command.y, 3);
});

test("changing a param value changes the sampled output", () => {
  const withA1 = sampleExpr("a*x", { min: 1, max: 1 }, 2, "x", { a: 1 });
  const withA5 = sampleExpr("a*x", { min: 1, max: 1 }, 2, "x", { a: 5 });
  assert.equal(withA1.commands[0]?.y, 1);
  assert.equal(withA5.commands[0]?.y, 5);
});

test("breaks the path into separate segments at singularities instead of drawing a garbage line through them", () => {
  // resolution 9 over [-2,2] samples at step 0.5: -2,-1.5,-1,-0.5,0,0.5,1,1.5,2
  // -- the singularities at x=-1 and x=1 land exactly on sample points.
  const path = sampleExpr("1/(x^2-1)", { min: -2, max: 2 }, 9);
  const moveTos = path.commands.filter((c) => c.op === "moveTo");
  assert.equal(moveTos.length, 3);
  assert.ok(path.commands.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y)));
});

test("sampleExpr defaults to the standard blue when no color is given, and honors an explicit color", () => {
  const defaultPath = sampleExpr("x", { min: 0, max: 1 }, 2);
  assert.equal(defaultPath.stroke.color, 0x2563eb);
  const redPath = sampleExpr("x", { min: 0, max: 1 }, 2, "x", {}, 0xdc2626);
  assert.equal(redPath.stroke.color, 0xdc2626);
});

test("sampleExprAdaptive adds no extra points for an already-straight line", () => {
  const path = sampleExprAdaptive("2*x+1", { min: -1, max: 1 }, 5);
  assert.equal(path.commands.length, 5);
});

test("sampleExprAdaptive refines beyond the base grid where the curve is sharply nonlinear", () => {
  // A narrow bump that a 5-point base grid straddles almost entirely (only
  // sampling near x=0, ±0.5, ±1) -- adaptive refinement must add points a
  // plain sampleExpr at the same base resolution wouldn't have.
  const uniform = sampleExpr("exp(-100*x^2)", { min: -1, max: 1 }, 5);
  const adaptive = sampleExprAdaptive("exp(-100*x^2)", { min: -1, max: 1 }, 5, "x", {}, 0x2563eb, { maxDepth: 6, tolerance: 1e-4 });
  assert.ok(adaptive.commands.length > uniform.commands.length);
});

test("sampleExprAdaptive matches the analytic value closely at a refined point", () => {
  const path = sampleExprAdaptive("x^3", { min: -1, max: 1 }, 3, "x", {}, 0x2563eb, { maxDepth: 8, tolerance: 1e-6 });
  const near0 = path.commands.reduce((best, c) => (Math.abs(c.x) < Math.abs(best.x) ? c : best));
  assert.ok(Math.abs(near0.y - near0.x ** 3) < 1e-4);
});

test("sampleExprAdaptive still produces gaps at singularities (does not force a bad midpoint sample in)", () => {
  const path = sampleExprAdaptive("1/(x^2-1)", { min: -2, max: 2 }, 9, "x", {}, 0x2563eb, { maxDepth: 4, tolerance: 1e-4 });
  const moveTos = path.commands.filter((c) => c.op === "moveTo");
  assert.equal(moveTos.length, 3);
  assert.ok(path.commands.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y)));
});

test("sampleRegionMask returns null for a non-cmp expression", () => {
  assert.equal(sampleRegionMask(Symbolic.parse("x^2"), { min: -2, max: 2 }, 5), null);
});

test("sampleRegionMask marks true where the comparison holds, for a simple x<0 case", () => {
  const mask = sampleRegionMask(Symbolic.parse("x<0"), { min: -2, max: 2 }, 5);
  // samples at -2, -1, 0, 1, 2 -- true for -2 and -1, false for 0, 1, 2
  assert.deepEqual(mask, [true, true, false, false, false]);
});
