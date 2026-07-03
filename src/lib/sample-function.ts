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
  const segments = runs
    .filter((run) => run.length > 0)
    .map((run) => GraphUtils.vectorToCurve(Vector.fromArray(run), 2, 0x2563eb));
  if (segments.length === 0) return GraphUtils.vectorToCurve(Vector.fromArray([]), 2, 0x2563eb);
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
