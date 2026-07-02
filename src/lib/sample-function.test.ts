import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleExpr } from "./sample-function.ts";

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
