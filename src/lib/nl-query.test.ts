import assert from "node:assert/strict";
import { test } from "node:test";
import { Symbolic } from "mallory-math";
import { resolveNaturalLanguageQuery } from "./nl-query.ts";

test("resolves 'derivative of' with implicit multiplication", () => {
  const source = resolveNaturalLanguageQuery("derivative of x^2 sin(x)");
  assert.ok(source);
  assert.equal(Symbolic.evaluate(source, { x: 1 }), Symbolic.evaluate(Symbolic.differentiate("x^2*sin(x)"), { x: 1 }));
});

test("resolves 'd/dx of'", () => {
  const source = resolveNaturalLanguageQuery("d/dx of x^3");
  assert.equal(source, "3*x^2");
});

test("resolves 'the derivative of'", () => {
  const source = resolveNaturalLanguageQuery("the derivative of x^2");
  assert.equal(source, "2*x");
});

test("resolves 'integral of' and 'antiderivative of'", () => {
  assert.equal(resolveNaturalLanguageQuery("integral of cos(x)"), "sin(x)");
  assert.equal(resolveNaturalLanguageQuery("antiderivative of cos(x)"), "sin(x)");
});

test("resolves 'simplify'", () => {
  assert.equal(resolveNaturalLanguageQuery("simplify x + 0"), "x");
});

test("returns null for a plain expression that matches no phrasing", () => {
  assert.equal(resolveNaturalLanguageQuery("x^2 + 1"), null);
});

test("returns null when the matched inner text fails to resolve", () => {
  // sin(x^2) has no elementary antiderivative -- Symbolic.integrate throws.
  assert.equal(resolveNaturalLanguageQuery("integral of sin(x^2)"), null);
});

test("resolves bounded 'integral of X from A to B' to a numeric value", () => {
  const source = resolveNaturalLanguageQuery("integral of x^2 from 0 to 1");
  assert.ok(source);
  assert.ok(Math.abs(Number(source) - 1 / 3) < 1e-9);
});

test("resolves bounded 'definite integral of X from A to B'", () => {
  const source = resolveNaturalLanguageQuery("definite integral of cos(x) from 0 to 1");
  assert.ok(source);
  assert.ok(Math.abs(Number(source) - Math.sin(1)) < 1e-9);
});

test("bare (unbounded) 'integral of' phrasing still matches after adding the bounded pattern first", () => {
  assert.equal(resolveNaturalLanguageQuery("integral of cos(x)"), "sin(x)");
});
