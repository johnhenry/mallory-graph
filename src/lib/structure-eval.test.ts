import assert from "node:assert/strict";
import { test } from "node:test";
import { Structure, Symbolic } from "mallory-math";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import { evaluateExprOverStructure } from "./structure-eval.ts";

function parse(source: string) {
  return Symbolic.parse(preprocessImplicitMultiplication(source));
}

test("evaluates addition and multiplication over Z/7Z", () => {
  const gf7 = Structure.integersModulo(7);
  const result = evaluateExprOverStructure(parse("3+5"), gf7, {});
  assert.equal(result, 1); // 8 mod 7
});

test("evaluates a bound variable over Z/7Z", () => {
  const gf7 = Structure.integersModulo(7);
  const result = evaluateExprOverStructure(parse("x^2+1"), gf7, { x: 5 });
  assert.equal(result, 5); // 25+1=26, 26 mod 7 = 5
});

test("evaluates negation over Z/7Z", () => {
  const gf7 = Structure.integersModulo(7);
  const result = evaluateExprOverStructure(parse("-3"), gf7, {});
  assert.equal(result, 4); // -3 mod 7 = 4
});

test("evaluates division by an invertible element over GF(7)", () => {
  const gf7 = Structure.integersModulo(7);
  const result = evaluateExprOverStructure(parse("1/3"), gf7, {});
  assert.equal(result, 5); // 3*5=15=1 mod 7, so 1/3=5
});

test("throws on an irrational function node", () => {
  const gf7 = Structure.integersModulo(7);
  assert.throws(() => evaluateExprOverStructure(parse("sin(1)"), gf7, {}));
});

test("throws on a non-integer-literal exponent", () => {
  const gf7 = Structure.integersModulo(7);
  assert.throws(() => evaluateExprOverStructure(parse("x^(1/2)"), gf7, { x: 2 }));
});

test("throws when a variable has no bound value", () => {
  const gf7 = Structure.integersModulo(7);
  assert.throws(() => evaluateExprOverStructure(parse("x+1"), gf7, {}));
});

// Symbolic.parse is used directly (not the local parse() helper) below --
// implicit-mult's tokenizer doesn't yet handle comparison operators (that's
// a separate, later change).
test("eq/ne use the structure's own equality over Z/7Z", () => {
  const gf7 = Structure.integersModulo(7);
  // 3 mod 7 == 10 mod 7 (both 3), even though the raw literals differ
  assert.equal(evaluateExprOverStructure(Symbolic.parse("3==10"), gf7, {}), 1);
  assert.equal(evaluateExprOverStructure(Symbolic.parse("3!=10"), gf7, {}), 0);
  assert.equal(evaluateExprOverStructure(Symbolic.parse("3==4"), gf7, {}), 0);
});

test("ordering comparisons throw over a structure with no general order", () => {
  const gf7 = Structure.integersModulo(7);
  assert.throws(() => evaluateExprOverStructure(Symbolic.parse("3<4"), gf7, {}));
  assert.throws(() => evaluateExprOverStructure(Symbolic.parse("3<=4"), gf7, {}));
  assert.throws(() => evaluateExprOverStructure(Symbolic.parse("3>4"), gf7, {}));
  assert.throws(() => evaluateExprOverStructure(Symbolic.parse("3>=4"), gf7, {}));
});

test("piecewise branch selection uses structure.zero-equality", () => {
  const gf7 = Structure.integersModulo(7);
  const result = evaluateExprOverStructure(Symbolic.parse("piecewise(3==10, 5, 2)"), gf7, {});
  assert.equal(result, 5);
  const otherwise = evaluateExprOverStructure(Symbolic.parse("piecewise(3==4, 5, 2)"), gf7, {});
  assert.equal(otherwise, 2);
});
