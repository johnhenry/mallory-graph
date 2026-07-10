import assert from "node:assert/strict";
import { test } from "node:test";
import { interiorAngleRadians, shoelaceArea } from "./geometry.ts";

test("interiorAngleRadians reports 90 degrees for a right angle", () => {
  const a = { x: 1, y: 0 };
  const vertex = { x: 0, y: 0 };
  const c = { x: 0, y: 1 };
  assert.ok(Math.abs(interiorAngleRadians(a, vertex, c) - Math.PI / 2) < 1e-9);
});

test("interiorAngleRadians reports 180 degrees for a straight line", () => {
  const a = { x: -1, y: 0 };
  const vertex = { x: 0, y: 0 };
  const c = { x: 1, y: 0 };
  assert.ok(Math.abs(interiorAngleRadians(a, vertex, c) - Math.PI) < 1e-9);
});

test("interiorAngleRadians always reports the non-reflex angle", () => {
  // a at 10 degrees, c at 350 degrees -- the short way around is 20 degrees, not 340.
  const vertex = { x: 0, y: 0 };
  const a = { x: Math.cos((10 * Math.PI) / 180), y: Math.sin((10 * Math.PI) / 180) };
  const c = { x: Math.cos((350 * Math.PI) / 180), y: Math.sin((350 * Math.PI) / 180) };
  const angle = interiorAngleRadians(a, vertex, c);
  assert.ok(angle < Math.PI);
  assert.ok(Math.abs(angle - (20 * Math.PI) / 180) < 1e-6);
});

test("shoelaceArea computes a unit square's area as 1", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  assert.ok(Math.abs(shoelaceArea(square) - 1) < 1e-9);
});

test("shoelaceArea computes a right triangle's area correctly", () => {
  const triangle = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ];
  assert.ok(Math.abs(shoelaceArea(triangle) - 6) < 1e-9);
});

test("shoelaceArea is winding-order independent (abs value)", () => {
  const clockwise = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ];
  assert.ok(Math.abs(shoelaceArea(clockwise) - 1) < 1e-9);
});
