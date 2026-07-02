import type { Path2D as MalloryPath } from "mallory-ts";

/** Data-space bounds mapped onto the full canvas. */
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Draw a mallory-ts Path2D (moveTo/lineTo commands in data space) onto a real Canvas2D context. */
export function drawPath(ctx: CanvasRenderingContext2D, path: MalloryPath, viewport: Viewport, width: number, height: number): void {
  const toScreenX = (x: number) => ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * width;
  const toScreenY = (y: number) => height - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * height;

  ctx.save();
  ctx.strokeStyle = `#${path.stroke.color.toString(16).padStart(6, "0")}`;
  ctx.globalAlpha = path.stroke.alpha;
  ctx.lineWidth = path.stroke.thickness || 1;
  ctx.beginPath();
  for (const cmd of path.commands) {
    const sx = toScreenX(cmd.x);
    const sy = toScreenY(cmd.y);
    if (cmd.op === "moveTo") ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();
}
