import { GraphUtils, Symbolic, Vector, type Expr, type Path2D } from "mallory-ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

export interface Domain {
  min: number;
  max: number;
}

/**
 * Sample a single-variable expression over a domain into a mallory-ts
 * Path2D. Uses Symbolic.compile (a closure tree built once) rather than
 * evaluate (which re-parses/re-walks the AST per call) since this runs
 * `resolution` times per render. String input is run through the
 * implicit-multiplication preprocessor first, since Symbolic.parse's grammar
 * requires an explicit `*` between factors. `params` (e.g. slider values for
 * free variables like `a`,`b` in `a*x^2+b`) is merged into the environment
 * object once outside the sampling loop, mutating only the axis field per
 * iteration, to avoid reallocating per sample.
 */
export function sampleExpr(
  expr: Expr | string,
  domain: Domain,
  resolution: number,
  variable = "x",
  params: Record<string, number> = {},
): Path2D {
  const compiled = Symbolic.compile(typeof expr === "string" ? preprocessImplicitMultiplication(expr) : expr);
  const points = new Array<Vector<number>>(resolution);
  const env: Record<string, number> = { ...params, [variable]: 0 };
  for (let i = 0; i < resolution; i++) {
    const x = domain.min + (i / (resolution - 1)) * (domain.max - domain.min);
    env[variable] = x;
    const y = compiled(env);
    points[i] = Vector.fromArray([x, y]);
  }
  return GraphUtils.vectorToCurve(Vector.fromArray(points), 2, 0x2563eb);
}
