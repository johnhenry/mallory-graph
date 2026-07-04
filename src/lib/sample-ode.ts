import { GraphUtils, Numerical, Symbolic, Vector, type Expr, type Path2D } from "mallory-math";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";
import type { Domain } from "./sample-function.ts";

export interface SlopeFieldPoint {
  x: number;
  y: number;
  slope: number;
}

const SOLUTION_COLOR = 0x16a34a; // distinct from the curve/area blue, so a solution overlaid on a plotted f(x,y)=0 relation reads as a separate object

/**
 * Numerically solves the first-order IVP dy/dx = f(x, y), y(x0) = y0, across
 * `xDomain` via RK4 (Numerical.rk4) -- forward from x0 to xDomain.max, and
 * backward from x0 down to xDomain.min via the substitution s = -x (so
 * `Numerical.rk4`, which always integrates forward in its own time
 * variable, can walk backward in x).
 *
 * A non-finite y (the solution blowing up, e.g. dy/dx = y^2 escaping to
 * infinity in finite x) truncates that direction's run rather than
 * poisoning the whole curve, mirroring sampleExpr's gap-tolerant-run
 * convention -- just bounded by "solver diverged" instead of "undefined at
 * this sample". Non-goal: fixed step size, no adaptive refinement near a
 * singularity.
 */
export function sampleOdeSolution(
  expr: Expr | string,
  x0: number,
  y0: number,
  xDomain: Domain,
  steps = 200,
): Path2D {
  const parsed = typeof expr === "string" ? Symbolic.parse(preprocessImplicitMultiplication(expr)) : expr;
  const compiled = Symbolic.compile(parsed);
  const f = (x: number, y: number): number => compiled({ x, y });

  function collectRun(target: number): number[][] {
    const run: number[][] = [];
    if (Math.abs(target - x0) < 1e-12) return run;
    const forward = target > x0;
    const h = Math.abs(target - x0) / steps;
    const odeFn = forward
      ? (t: number, ys: number[]): number[] => [f(t, ys[0] as number)]
      : (s: number, ys: number[]): number[] => [-f(-s, ys[0] as number)];
    const t0 = forward ? x0 : -x0;
    const t1 = forward ? target : -target;
    for (const step of Numerical.rk4(odeFn, [y0], t0, t1, h)) {
      const x = forward ? step.t : -step.t;
      const y = step.y[0] as number;
      if (!Number.isFinite(y)) break;
      run.push([x, y]);
    }
    return run;
  }

  const backwardRun = collectRun(xDomain.min).reverse(); // reverse -> x-ascending
  const forwardRun = collectRun(xDomain.max);
  // Both runs' first element is the (x0,y0) step (rk4 always seeds its
  // output with {t0,y0}); backwardRun's got moved to its *last* position by
  // the reverse() above, and forwardRun's is at its first, so drop
  // backwardRun's duplicate to avoid drawing (x0,y0) twice at the seam.
  if (backwardRun.length > 0) backwardRun.pop();

  const runs = [backwardRun, forwardRun].filter((run) => run.length > 0);
  if (runs.length === 0) {
    return GraphUtils.vectorToCurve(Vector.fromArray([Vector.fromArray([x0, y0])]), 2, SOLUTION_COLOR);
  }
  const segments = runs.map((run) => GraphUtils.vectorToCurve(Vector.fromArray(run.map((p) => Vector.fromArray(p))), 2, SOLUTION_COLOR));
  return { stroke: (segments[0] as Path2D).stroke, commands: segments.flatMap((s) => s.commands) };
}

/**
 * Samples dy/dx = f(x, y) over a grid spanning `xDomain`×`yDomain` for a
 * slope-field renderer. Points where `f` isn't finite (e.g. a genuine
 * singularity of the vector field) are simply omitted.
 */
export function sampleSlopeField(
  expr: Expr | string,
  xDomain: Domain,
  yDomain: Domain,
  gridDensity = 17,
): SlopeFieldPoint[] {
  const parsed = typeof expr === "string" ? Symbolic.parse(preprocessImplicitMultiplication(expr)) : expr;
  const compiled = Symbolic.compile(parsed);
  const points: SlopeFieldPoint[] = [];
  for (let i = 0; i < gridDensity; i++) {
    const x = xDomain.min + (i / (gridDensity - 1)) * (xDomain.max - xDomain.min);
    for (let j = 0; j < gridDensity; j++) {
      const y = yDomain.min + (j / (gridDensity - 1)) * (yDomain.max - yDomain.min);
      const slope = compiled({ x, y });
      if (Number.isFinite(slope)) points.push({ x, y, slope });
    }
  }
  return points;
}
