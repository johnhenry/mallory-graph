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
