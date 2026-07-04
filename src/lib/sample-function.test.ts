import assert from "node:assert/strict";
import { test } from "node:test";
import { Symbolic } from "mallory-math";
import { sampleExpr, sampleRegionMask } from "./sample-function.ts";

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

test("sampleRegionMask returns null for a non-cmp expression", () => {
  assert.equal(sampleRegionMask(Symbolic.parse("x^2"), { min: -2, max: 2 }, 5), null);
});

test("sampleRegionMask marks true where the comparison holds, for a simple x<0 case", () => {
  const mask = sampleRegionMask(Symbolic.parse("x<0"), { min: -2, max: 2 }, 5);
  // samples at -2, -1, 0, 1, 2 -- true for -2 and -1, false for 0, 1, 2
  assert.deepEqual(mask, [true, true, false, false, false]);
});
