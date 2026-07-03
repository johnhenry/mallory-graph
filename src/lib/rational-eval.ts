import { Rational, type CmpOp, type Expr } from "mallory-math";

/**
 * Evaluates a Symbolic Expr exactly over Rational arithmetic, for the
 * Exact-arithmetic display mode (e.g. `1/3` renders as a fraction, not
 * `0.333...`). Throws whenever the expression isn't exactly representable —
 * any `func` node (sin/cos/sqrt/etc. are generally irrational) or a `pow`
 * whose exponent isn't an integer — so callers should fall back to a plain
 * float display on catch.
 */
export function evaluateExprAsRational(expr: Expr, env: Record<string, Rational>): Rational {
  switch (expr.type) {
    case "const":
      return Rational.fromNumber(expr.value);
    case "var": {
      const value = env[expr.name];
      if (!value) throw new Error(`No exact value bound for "${expr.name}"`);
      return value;
    }
    case "add":
      return evaluateExprAsRational(expr.left, env).add(evaluateExprAsRational(expr.right, env));
    case "sub":
      return evaluateExprAsRational(expr.left, env).subtract(evaluateExprAsRational(expr.right, env));
    case "mul":
      return evaluateExprAsRational(expr.left, env).multiply(evaluateExprAsRational(expr.right, env));
    case "div":
      return evaluateExprAsRational(expr.left, env).divide(evaluateExprAsRational(expr.right, env));
    case "pow": {
      const exponent = evaluateExprAsRational(expr.exp, env);
      if (exponent.denominator !== 1n) throw new Error("Exact pow requires an integer exponent");
      return evaluateExprAsRational(expr.base, env).pow(Number(exponent.numerator));
    }
    case "neg":
      return evaluateExprAsRational(expr.arg, env).negate();
    case "func":
      throw new Error(`"${expr.name}" is not exactly representable as a Rational`);
    case "call2":
      throw new Error(`"${expr.name}" is not exactly representable as a Rational`);
    case "cmp": {
      // cmp's result is always exactly {0,1} -- unlike func/call2, no need to
      // throw; Rational already has an exact .compare().
      const l = evaluateExprAsRational(expr.left, env);
      const r = evaluateExprAsRational(expr.right, env);
      const c = l.compare(r);
      const truth = CMP_TRUTH[expr.op](c);
      return truth ? Rational.One : Rational.Zero;
    }
    case "piecewise": {
      for (const branch of expr.branches) {
        if (!evaluateExprAsRational(branch.cond, env).isZero()) {
          return evaluateExprAsRational(branch.expr, env);
        }
      }
      return evaluateExprAsRational(expr.otherwise, env);
    }
  }
}

const CMP_TRUTH: Record<CmpOp, (c: number) => boolean> = {
  lt: (c) => c < 0,
  le: (c) => c <= 0,
  gt: (c) => c > 0,
  ge: (c) => c >= 0,
  eq: (c) => c === 0,
  ne: (c) => c !== 0,
};
