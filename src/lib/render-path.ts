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
