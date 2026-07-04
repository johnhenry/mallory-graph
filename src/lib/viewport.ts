export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Data-space <-> screen-space affine mapping shared by rendering and hit-testing. */
export function toScreenX(x: number, viewport: Viewport, width: number): number {
  return ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * width;
}

export function toScreenY(y: number, viewport: Viewport, height: number): number {
  return height - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * height;
}

export function toDataX(sx: number, viewport: Viewport, width: number): number {
  return viewport.xMin + (sx / width) * (viewport.xMax - viewport.xMin);
}

export function toDataY(sy: number, viewport: Viewport, height: number): number {
  return viewport.yMin + ((height - sy) / height) * (viewport.yMax - viewport.yMin);
}

/**
 * A pointer event's `clientX`/`clientY` minus the canvas's bounding-rect
 * offset are in *displayed* CSS pixels, not the canvas's intrinsic
 * width/height -- the two only match when the canvas is shown at 1:1 scale.
 * Mobile layouts shrink the canvas via `max-width: 100%` (see styles.css),
 * so this rescales by displayed-size/intrinsic-size before handing off to
 * `toDataX`/`toDataY`, which assume intrinsic pixel coordinates.
 */
export function canvasEventPoint(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): { sx: number; sy: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    sx: ((e.clientX - rect.left) / rect.width) * width,
    sy: ((e.clientY - rect.top) / rect.height) * height,
  };
}
