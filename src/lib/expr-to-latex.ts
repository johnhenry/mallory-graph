import type { Expr, FuncName } from "mallory-ts";

const PREC: Record<string, number> = { add: 1, sub: 1, mul: 2, div: 2, neg: 3, pow: 4 };

const FUNC_LATEX: Record<FuncName, (arg: string) => string> = {
  sin: (a) => `\\sin(${a})`,
  cos: (a) => `\\cos(${a})`,
  tan: (a) => `\\tan(${a})`,
  exp: (a) => `e^{${a}}`,
  ln: (a) => `\\ln(${a})`,
  sqrt: (a) => `\\sqrt{${a}}`,
};

/** Renders a Symbolic Expr as LaTeX, mirroring mallory-ts's own plain-infix `Symbolic.toString` renderer but targeting math markup (KaTeX) instead of a bare string. */
export function exprToLatex(expr: Expr, parentPrec = 0): string {
  switch (expr.type) {
    case "const":
      return `${expr.value}`;
    case "var":
      return expr.name;
    case "func":
      return FUNC_LATEX[expr.name](exprToLatex(expr.arg, 0));
    case "neg":
      return wrap(`-${exprToLatex(expr.arg, PREC.neg)}`, PREC.neg, parentPrec);
    case "pow":
      return wrap(`${exprToLatex(expr.base, PREC.pow + 1)}^{${exprToLatex(expr.exp, 0)}}`, PREC.pow, parentPrec);
    case "add":
      return wrap(`${exprToLatex(expr.left, PREC.add)} + ${exprToLatex(expr.right, PREC.add)}`, PREC.add, parentPrec);
    case "sub":
      return wrap(`${exprToLatex(expr.left, PREC.sub)} - ${exprToLatex(expr.right, PREC.sub + 1)}`, PREC.sub, parentPrec);
    case "mul":
      return wrap(`${exprToLatex(expr.left, PREC.mul)} \\cdot ${exprToLatex(expr.right, PREC.mul + 1)}`, PREC.mul, parentPrec);
    case "div":
      return `\\frac{${exprToLatex(expr.left, 0)}}{${exprToLatex(expr.right, 0)}}`;
  }
}

function wrap(s: string, prec: number, parentPrec: number): string {
  return prec < parentPrec ? `\\left(${s}\\right)` : s;
}
