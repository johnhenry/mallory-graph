import { Rational, type Expr } from "mallory-math";

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
  }
}
