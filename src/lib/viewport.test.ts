import assert from "node:assert/strict";
import { test } from "node:test";
import { toDataX, toDataY, toScreenX, toScreenY, type Viewport } from "./viewport.ts";

const VIEWPORT: Viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
const WIDTH = 600;
const HEIGHT = 600;

test("toScreenX/toDataX round-trip", () => {
  const dataX = 3.5;
  assert.ok(Math.abs(toDataX(toScreenX(dataX, VIEWPORT, WIDTH), VIEWPORT, WIDTH) - dataX) < 1e-9);
});

test("toScreenY/toDataY round-trip", () => {
  const dataY = -4.25;
  assert.ok(Math.abs(toDataY(toScreenY(dataY, VIEWPORT, HEIGHT), VIEWPORT, HEIGHT) - dataY) < 1e-9);
});

test("data origin maps to screen center for a symmetric viewport", () => {
  assert.equal(toScreenX(0, VIEWPORT, WIDTH), WIDTH / 2);
  assert.equal(toScreenY(0, VIEWPORT, HEIGHT), HEIGHT / 2);
});
