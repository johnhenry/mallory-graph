import assert from "node:assert/strict";
import { test } from "node:test";
import { Rational, Symbolic } from "mallory-math";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { evaluateExprAsRational } from "./rational-eval.ts";

function parse(source: string) {
  return Symbolic.parse(preprocessImplicitMultiplication(source));
}

test("evaluates a plain fraction exactly", () => {
  const result = evaluateExprAsRational(parse("1/3"), {});
  assert.equal(result.toString(), "1/3");
});

test("evaluates an expression with a bound exact variable", () => {
  const result = evaluateExprAsRational(parse("x+1/2"), { x: new Rational(1n, 2n) });
  assert.equal(result.toString(), "1");
});

test("evaluates integer powers exactly", () => {
  const result = evaluateExprAsRational(parse("(1/2)^3"), {});
  assert.equal(result.toString(), "1/8");
});

test("evaluates negation exactly", () => {
  const result = evaluateExprAsRational(parse("-1/4"), {});
  assert.equal(result.toString(), "-1/4");
});

test("throws on an irrational function node", () => {
  assert.throws(() => evaluateExprAsRational(parse("sin(1)"), {}));
});

test("throws on a non-integer exponent", () => {
  assert.throws(() => evaluateExprAsRational(parse("2^(1/2)"), {}));
});

test("throws when a variable has no bound exact value", () => {
  assert.throws(() => evaluateExprAsRational(parse("x+1"), {}));
});
