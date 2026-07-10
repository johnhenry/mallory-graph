export interface Point2D {
  x: number;
  y: number;
}

/**
 * Interior angle at `vertex` between rays to `a` and `c`, in radians,
 * always in [0, PI] (the non-reflex angle) -- the standard "angle ABC"
 * convention where B is the vertex.
 */
export function interiorAngleRadians(a: Point2D, vertex: Point2D, c: Point2D): number {
  const v1 = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const v2 = Math.atan2(c.y - vertex.y, c.x - vertex.x);
  let diff = Math.abs(v2 - v1);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff;
}

/** Shoelace formula: area of a simple (non-self-intersecting) polygon given its vertices in order. */
export function shoelaceArea(points: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i] as Point2D;
    const p2 = points[(i + 1) % points.length] as Point2D;
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) / 2;
}
