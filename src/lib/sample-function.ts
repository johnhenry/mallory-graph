import { GraphUtils, Symbolic, Vector, type Expr, type Path2D } from "mallory-math";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

export interface Domain {
  min: number;
  max: number;
}

/**
 * Sample a single-variable expression over a domain into a mallory-math
 * Path2D. Uses Symbolic.compile (a closure tree built once) rather than
 * evaluate (which re-parses/re-walks the AST per call) since this runs
 * `resolution` times per render. String input is run through the
 * implicit-multiplication preprocessor first, since Symbolic.parse's grammar
 * requires an explicit `*` between factors. `params` (e.g. slider values for
 * free variables like `a`,`b` in `a*x^2+b`) is merged into the environment
 * object once outside the sampling loop, mutating only the axis field per
 * iteration, to avoid reallocating per sample.
 *
 * `GraphUtils.vectorToCurve` (upstream, unmodifiable) connects every point
 * unconditionally via `lineTo` -- a NaN/Infinity sample (e.g. at an
 * asymptote, or a piecewise/comparison expression's discontinuity) would
 * otherwise draw a garbage line straight through the gap. Segmenting the
 * samples into contiguous finite runs first, and calling `vectorToCurve`
 * once per run, produces the gap for free: each run's own leading `moveTo`
 * becomes the break when the command arrays are concatenated.
 */
export function sampleExpr(
  expr: Expr | string,
  domain: Domain,
  resolution: number,
  variable = "x",
  params: Record<string, number> = {},
  color = 0x2563eb,
): Path2D {
  const compiled = Symbolic.compile(typeof expr === "string" ? preprocessImplicitMultiplication(expr) : expr);
  const env: Record<string, number> = { ...params, [variable]: 0 };
  const runs: Vector<number>[][] = [[]];
  for (let i = 0; i < resolution; i++) {
    const x = domain.min + (i / (resolution - 1)) * (domain.max - domain.min);
    env[variable] = x;
    const y = compiled(env);
    if (Number.isFinite(y)) {
      (runs[runs.length - 1] as Vector<number>[]).push(Vector.fromArray([x, y]));
    } else if ((runs[runs.length - 1] as Vector<number>[]).length > 0) {
      runs.push([]);
    }
  }
  const segments = runs.filter((run) => run.length > 0).map((run) => GraphUtils.vectorToCurve(Vector.fromArray(run), 2, color));
  if (segments.length === 0) return GraphUtils.vectorToCurve(Vector.fromArray([]), 2, color);
  return { stroke: (segments[0] as Path2D).stroke, commands: segments.flatMap((s) => s.commands) };
}

export interface AdaptiveOptions {
  /** How many times a single base-grid segment may be bisected. */
  maxDepth?: number;
  /** A segment is bisected further when its midpoint sample deviates from straight-line interpolation by more than this, in y-units. */
  tolerance?: number;
}

/**
 * Like `sampleExpr`, but refines the fixed uniform grid where the curve is
 * locally non-linear: for each pair of adjacent base-grid points, evaluate
 * the midpoint and compare it to straight-line interpolation between the
 * two -- if they disagree by more than `tolerance`, recurse into both
 * halves (up to `maxDepth`). A segment that's already locally straight adds
 * no extra points, so a gentle curve costs the same as `sampleExpr`, while a
 * sharp bend or narrow spike that a uniform grid could straddle gets
 * resolved. Non-goal: `tolerance` is an absolute y-unit threshold, not
 * scaled to the viewport's y-range, so the same default may under- or
 * over-refine for functions with very different output scales.
 */
export function sampleExprAdaptive(
  expr: Expr | string,
  domain: Domain,
  baseResolution: number,
  variable = "x",
  params: Record<string, number> = {},
  color = 0x2563eb,
  options: AdaptiveOptions = {},
): Path2D {
  const { maxDepth = 4, tolerance = 1e-3 } = options;
  const compiled = Symbolic.compile(typeof expr === "string" ? preprocessImplicitMultiplication(expr) : expr);
  const env: Record<string, number> = { ...params, [variable]: 0 };
  function evalAt(x: number): number {
    env[variable] = x;
    return compiled(env);
  }

  const basePoints: { x: number; y: number }[] = [];
  for (let i = 0; i < baseResolution; i++) {
    const x = domain.min + (i / (baseResolution - 1)) * (domain.max - domain.min);
    basePoints.push({ x, y: evalAt(x) });
  }

  function refine(a: { x: number; y: number }, b: { x: number; y: number }, depth: number): { x: number; y: number }[] {
    if (depth >= maxDepth || !Number.isFinite(a.y) || !Number.isFinite(b.y)) return [a];
    const xm = (a.x + b.x) / 2;
    const ym = evalAt(xm);
    // A non-finite midpoint means a singularity lives between a and b -- let
    // the base grid's own gap-detection (below) handle that boundary rather
    // than forcing a bad sample into the middle of an otherwise-good run.
    if (!Number.isFinite(ym)) return [a];
    const linearY = (a.y + b.y) / 2;
    if (Math.abs(ym - linearY) <= tolerance) return [a];
    const mid = { x: xm, y: ym };
    return [...refine(a, mid, depth + 1), ...refine(mid, b, depth + 1)];
  }

  const refinedPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < basePoints.length - 1; i++) {
    refinedPoints.push(...refine(basePoints[i] as { x: number; y: number }, basePoints[i + 1] as { x: number; y: number }, 0));
  }
  const last = basePoints[basePoints.length - 1];
  if (last) refinedPoints.push(last);

  const runs: Vector<number>[][] = [[]];
  for (const p of refinedPoints) {
    if (Number.isFinite(p.y)) {
      (runs[runs.length - 1] as Vector<number>[]).push(Vector.fromArray([p.x, p.y]));
    } else if ((runs[runs.length - 1] as Vector<number>[]).length > 0) {
      runs.push([]);
    }
  }
  const segments = runs.filter((run) => run.length > 0).map((run) => GraphUtils.vectorToCurve(Vector.fromArray(run), 2, color));
  if (segments.length === 0) return GraphUtils.vectorToCurve(Vector.fromArray([]), 2, color);
  return { stroke: (segments[0] as Path2D).stroke, commands: segments.flatMap((s) => s.commands) };
}

/**
 * Samples a `cmp` (comparison) Expr at the same resolution/grid as
 * `sampleExpr`, producing one boolean per sample point (true where the
 * comparison holds), for grid-based 1D inequality shading along the x-axis.
 * Returns `null` if `expr`'s top-level node isn't a `cmp` node -- so callers
 * can pass any parsed expression and get "nothing to shade" for the common
 * (non-inequality) case, rather than needing to check the type themselves.
 */
export function sampleRegionMask(
  expr: Expr,
  domain: Domain,
  resolution: number,
  variable = "x",
  params: Record<string, number> = {},
): boolean[] | null {
  if (expr.type !== "cmp") return null;
  const compiled = Symbolic.compile(expr);
  const env: Record<string, number> = { ...params, [variable]: 0 };
  const mask = new Array<boolean>(resolution);
  for (let i = 0; i < resolution; i++) {
    const x = domain.min + (i / (resolution - 1)) * (domain.max - domain.min);
    env[variable] = x;
    mask[i] = compiled(env) !== 0;
  }
  return mask;
}
