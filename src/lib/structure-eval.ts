import { Structure, type Expr } from "mallory-math";

const ORDERING_OPS = new Set(["lt", "le", "gt", "ge"]);

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
    case "cmp": {
      // eq/ne are well-defined over any Structure via .equality(); ordering
      // comparisons have no general meaning (several structures, e.g.
      // quaternions, have no order compatible with their ring operations).
      if (ORDERING_OPS.has(expr.op)) {
        throw new Error(`Ordering comparisons ("${expr.op}") have no general meaning over this structure`);
      }
      const l = evaluateExprOverStructure(expr.left, structure, env);
      const r = evaluateExprOverStructure(expr.right, structure, env);
      const equal = structure.equality(l, r);
      const truth = expr.op === "eq" ? equal : !equal;
      return truth ? structure.one : structure.zero;
    }
    case "piecewise": {
      for (const branch of expr.branches) {
        const condValue = evaluateExprOverStructure(branch.cond, structure, env);
        if (!structure.equality(condValue, structure.zero)) {
          return evaluateExprOverStructure(branch.expr, structure, env);
        }
      }
      return evaluateExprOverStructure(expr.otherwise, structure, env);
    }
  }
}
