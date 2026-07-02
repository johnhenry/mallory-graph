import assert from "node:assert/strict";
import { test } from "node:test";
import { interpolateKeyframes, timelineDuration } from "./timeline.ts";

test("interpolateKeyframes returns 0 for an empty track", () => {
  assert.equal(interpolateKeyframes([], 5), 0);
});

test("interpolateKeyframes clamps before the first and after the last keyframe", () => {
  const track = [{ t: 1, value: 10 }, { t: 3, value: 20 }];
  assert.equal(interpolateKeyframes(track, 0), 10);
  assert.equal(interpolateKeyframes(track, 5), 20);
});

test("interpolateKeyframes linearly interpolates between two keyframes", () => {
  const track = [{ t: 0, value: 0 }, { t: 4, value: 8 }];
  assert.equal(interpolateKeyframes(track, 1), 2);
  assert.equal(interpolateKeyframes(track, 2), 4);
});

test("interpolateKeyframes picks the correct segment across three or more keyframes", () => {
  const track = [{ t: 0, value: 0 }, { t: 2, value: 10 }, { t: 4, value: 0 }];
  assert.equal(interpolateKeyframes(track, 1), 5);
  assert.equal(interpolateKeyframes(track, 3), 5);
  assert.equal(interpolateKeyframes(track, 2), 10);
});

test("interpolateKeyframes returns the sole value for a single-keyframe track", () => {
  assert.equal(interpolateKeyframes([{ t: 2, value: 7 }], 0), 7);
  assert.equal(interpolateKeyframes([{ t: 2, value: 7 }], 100), 7);
});

test("timelineDuration is the latest keyframe across every animated track", () => {
  assert.equal(timelineDuration([[{ t: 0, value: 0 }, { t: 3, value: 1 }], undefined, [{ t: 0, value: 0 }, { t: 5, value: 1 }]]), 5);
});

test("timelineDuration is 0 when no track is animated", () => {
  assert.equal(timelineDuration([undefined, undefined]), 0);
});
