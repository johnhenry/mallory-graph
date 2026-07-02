import assert from "node:assert/strict";
import { test } from "node:test";
import { Symbolic } from "mallory-ts";
import { collectFreeVars, defaultSliderRange } from "./free-vars.ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

function parse(source: string) {
  return Symbolic.parse(preprocessImplicitMultiplication(source));
}

test("collects no free vars for a plain function of the axis variable", () => {
  assert.deepEqual(collectFreeVars(parse("x^2"), "x"), []);
});

test("collects a single free var from a*x^2+b", () => {
  assert.deepEqual(collectFreeVars(parse("a*x^2+b"), "x"), ["a", "b"]);
});

test("dedupes a free var used more than once", () => {
  assert.deepEqual(collectFreeVars(parse("a*x^2+a"), "x"), ["a"]);
});

test("collects free vars inside function call arguments", () => {
  assert.deepEqual(collectFreeVars(parse("sin(k*x)"), "x"), ["k"]);
});

test("sorts collected free vars", () => {
  assert.deepEqual(collectFreeVars(parse("c*x+b+a"), "x"), ["a", "b", "c"]);
});

test("integer-stepper names get a step-1 range", () => {
  assert.deepEqual(defaultSliderRange("n"), { min: -10, max: 10, step: 1, default: 1 });
  assert.deepEqual(defaultSliderRange("k"), { min: -10, max: 10, step: 1, default: 1 });
});

test("greek letter names get a 0..2pi angle range", () => {
  const range = defaultSliderRange("theta");
  assert.equal(range.min, 0);
  assert.ok(Math.abs(range.max - 2 * Math.PI) < 1e-12);
});

test("other names get a generic -10..10 range", () => {
  assert.deepEqual(defaultSliderRange("a"), { min: -10, max: 10, step: 0.1, default: 1 });
});
