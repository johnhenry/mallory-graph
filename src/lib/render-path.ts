import type { Path2D as MalloryPath } from "mallory-math";
import { toScreenX, toScreenY, type Viewport } from "./viewport.ts";

export type { Viewport } from "./viewport.ts";

/** Draw a mallory-math Path2D (moveTo/lineTo commands in data space) onto a real Canvas2D context. */
export function drawPath(ctx: CanvasRenderingContext2D, path: MalloryPath, viewport: Viewport, width: number, height: number): void {
  ctx.save();
  ctx.strokeStyle = `#${path.stroke.color.toString(16).padStart(6, "0")}`;
  ctx.globalAlpha = path.stroke.alpha;
  ctx.lineWidth = path.stroke.thickness || 1;
  ctx.beginPath();
  for (const cmd of path.commands) {
    const sx = toScreenX(cmd.x, viewport, width);
    const sy = toScreenY(cmd.y, viewport, height);
    if (cmd.op === "moveTo") ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw a filled circular handle at a data-space point (used for draggable points). */
export function drawPoint(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  viewport: Viewport,
  width: number,
  height: number,
  radius = 6,
  color = "#dc2626",
): void {
  const sx = toScreenX(point.x, viewport, width);
  const sy = toScreenY(point.y, viewport, height);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a translucent vertical-strip fill over every `true` entry of a
 * region mask (one boolean per sample point across a viewport-width grid,
 * same resolution as the curve it's shading). A grid-based fill, not an
 * exact boundary-curve computation, matching the mask's own sampling
 * resolution.
 */
export function drawRegionMask(
  ctx: CanvasRenderingContext2D,
  mask: boolean[],
  viewport: Viewport,
  width: number,
  height: number,
  color = "rgba(37, 99, 235, 0.15)",
): void {
  if (mask.length === 0) return;
  const stripWidth = width / mask.length;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = viewport.xMin + (i / Math.max(1, mask.length - 1)) * (viewport.xMax - viewport.xMin);
    const sx = toScreenX(x, viewport, width);
    ctx.fillRect(sx - stripWidth / 2, 0, stripWidth, height);
  }
  ctx.restore();
}

/**
 * Draw the area between a (possibly gap-broken) curve and y=0, one closed
 * fill polygon per contiguous run -- each `moveTo`-delimited segment from
 * `sampleExpr`'s gap-tolerant sampling gets its own polygon, so a
 * discontinuous integrand shades disjoint regions correctly instead of one
 * polygon spanning the gap.
 */
export function drawFilledArea(
  ctx: CanvasRenderingContext2D,
  path: MalloryPath,
  viewport: Viewport,
  width: number,
  height: number,
  color = "rgba(37, 99, 235, 0.25)",
): void {
  const zeroSy = toScreenY(0, viewport, height);
  ctx.save();
  ctx.fillStyle = color;
  let i = 0;
  while (i < path.commands.length) {
    const runStart = i;
    i++;
    while (i < path.commands.length && path.commands[i]?.op === "lineTo") i++;
    const run = path.commands.slice(runStart, i);
    if (run.length === 0) continue;
    const first = run[0];
    const last = run[run.length - 1];
    if (!first || !last) continue;
    ctx.beginPath();
    ctx.moveTo(toScreenX(first.x, viewport, width), zeroSy);
    for (const cmd of run) ctx.lineTo(toScreenX(cmd.x, viewport, width), toScreenY(cmd.y, viewport, height));
    ctx.lineTo(toScreenX(last.x, viewport, width), zeroSy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Draw a set of discrete data-space points as a scatter (used for finite-structure plots, e.g. GF(7)). */
export function drawScatter(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  viewport: Viewport,
  width: number,
  height: number,
  radius = 5,
  color = "#2563eb",
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (const p of points) {
    const sx = toScreenX(p.x, viewport, width);
    const sy = toScreenY(p.y, viewport, height);
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
