import { Graph3DUtils, Symbolic, Vector, type Mesh } from "mallory-ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

export interface SurfaceDomain {
  min: number;
  max: number;
}

/**
 * Sample a two-variable expression z=f(x,y) over a grid into mallory-ts
 * Graph3DUtils Mesh data (two triangle sweeps, non-indexed). Mirrors
 * sample-function.ts's sampleExpr: Symbolic.compile is built once outside
 * the sampling loop rather than re-parsing per grid point.
 */
export function sampleSurface(
  expr: string,
  xDomain: SurfaceDomain,
  yDomain: SurfaceDomain,
  resolution: number,
  params: Record<string, number> = {},
): Mesh[] {
  const compiled = Symbolic.compile(preprocessImplicitMultiplication(expr));
  const xStep = (xDomain.max - xDomain.min) / resolution;
  const yStep = (yDomain.max - yDomain.min) / resolution;
  const env: Record<string, number> = { ...params, x: 0, y: 0 };
  const matrix = Graph3DUtils.dualRangeVector(
    (x, y) => {
      env.x = x;
      env.y = y;
      return Vector.fromArray([x, y, compiled(env)]);
    },
    xDomain.min,
    xDomain.max,
    xStep,
    yDomain.min,
    yDomain.max,
    yStep,
  );
  return Graph3DUtils.pointMatrixToMesh3D(matrix, 0x2563eb, 1, 0x93c5fd, 1);
}
