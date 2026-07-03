import { Structure, type Expr } from "mallory-math";

/**
 * Evaluates a Symbolic Expr by folding it through an arbitrary {@link Structure}'s
 * own `add`/`multiply`/`negative`/`divide` instead of native JS math, so plotting
 * can work over e.g. Z/7Z instead of the reals. Throws on any `func` node
 * (sin/cos/etc. have no general meaning over an abstract structure) or a `pow`
 * whose exponent isn't a literal integer constant.
 */
export function evaluateExprOverStructure<T>(expr: Expr, structure: Structure<T>, env: Record<string, T>): T {
  switch (expr.type) {
    case "const":
      return structure.wrap(expr.value);
    case "var": {
      const value = env[expr.name];
      if (value === undefined) throw new Error(`No value bound for "${expr.name}"`);
      return structure.wrap(value);
    }
    case "add":
      return structure.add(
        evaluateExprOverStructure(expr.left, structure, env),
        evaluateExprOverStructure(expr.right, structure, env),
      );
    case "sub":
      return structure.subtract(
        evaluateExprOverStructure(expr.left, structure, env),
        evaluateExprOverStructure(expr.right, structure, env),
      );
    case "mul":
      return structure.multiply(
        evaluateExprOverStructure(expr.left, structure, env),
        evaluateExprOverStructure(expr.right, structure, env),
      );
    case "div":
      return structure.divide(
        evaluateExprOverStructure(expr.left, structure, env),
        evaluateExprOverStructure(expr.right, structure, env),
      );
    case "pow": {
      if (expr.exp.type !== "const" || !Number.isInteger(expr.exp.value)) {
        throw new Error("Structure-aware pow requires a literal integer exponent");
      }
      return structure.multiplyPower(evaluateExprOverStructure(expr.base, structure, env), expr.exp.value);
    }
    case "neg":
      return structure.negative(evaluateExprOverStructure(expr.arg, structure, env));
    case "func":
      throw new Error(`"${expr.name}" has no meaning over this structure`);
    case "call2":
      throw new Error(`"${expr.name}" has no meaning over this structure`);
  }
}
