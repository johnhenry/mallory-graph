import assert from "node:assert/strict";
import { test } from "node:test";
import { Symbolic } from "mallory-ts";
import { exprToLatex } from "./expr-to-latex.ts";

const latex = (source: string) => exprToLatex(Symbolic.parse(source));

test("renders a sum without extra parens", () => {
  assert.equal(latex("x + 1"), "x + 1");
});

test("renders multiplication with cdot", () => {
  assert.equal(latex("2*x"), "2 \\cdot x");
});

test("renders division as a fraction", () => {
  assert.equal(latex("x/2"), "\\frac{x}{2}");
});

test("renders powers with braces", () => {
  assert.equal(latex("x^2"), "x^{2}");
});

test("renders known functions with backslash commands", () => {
  assert.equal(latex("sin(x)"), "\\sin(x)");
  assert.equal(latex("sqrt(x)"), "\\sqrt{x}");
});

test("parenthesizes a sum nested inside a product", () => {
  assert.equal(latex("(x+1)*2"), "\\left(x + 1\\right) \\cdot 2");
});

test("parenthesizes a sum used as a power base", () => {
  assert.equal(latex("(x+1)^2"), "\\left(x + 1\\right)^{2}");
});
