import type { BinaryFuncName, Expr, FuncName } from "mallory-math";

const PREC: Record<string, number> = { add: 1, sub: 1, mul: 2, div: 2, neg: 3, pow: 4 };

// Functions with a standard bare LaTeX command, wrapped in plain parens
// (matching this file's existing convention, not mallory-math's own \left\right style).
const FUNC_LATEX: Partial<Record<FuncName, (arg: string) => string>> = {
  sin: (a) => `\\sin(${a})`,
  cos: (a) => `\\cos(${a})`,
  tan: (a) => `\\tan(${a})`,
  exp: (a) => `e^{${a}}`,
  ln: (a) => `\\ln(${a})`,
  sqrt: (a) => `\\sqrt{${a}}`,
  asin: (a) => `\\arcsin(${a})`,
  acos: (a) => `\\arccos(${a})`,
  atan: (a) => `\\arctan(${a})`,
  sinh: (a) => `\\sinh(${a})`,
  cosh: (a) => `\\cosh(${a})`,
  tanh: (a) => `\\tanh(${a})`,
  cot: (a) => `\\cot(${a})`,
  sec: (a) => `\\sec(${a})`,
  csc: (a) => `\\csc(${a})`,
  coth: (a) => `\\coth(${a})`,
  cbrt: (a) => `\\sqrt[3]{${a}}`,
  abs: (a) => `\\left|${a}\\right|`,
  floor: (a) => `\\left\\lfloor ${a}\\right\\rfloor`,
  ceil: (a) => `\\left\\lceil ${a}\\right\\rceil`,
  log10: (a) => `\\log_{10}(${a})`,
  log2: (a) => `\\log_{2}(${a})`,
};

// Everything else has no standard bare LaTeX command — \operatorname, matching
// the convention KaTeX/MathJax and mallory-math's own toLatex use for them.
const OPERATORNAME_LATEX: Partial<Record<FuncName, string>> = {
  sech: "sech",
  csch: "csch",
  asinh: "arcsinh",
  acosh: "arccosh",
  atanh: "arctanh",
  acot: "arccot",
  asec: "arcsec",
  acsc: "arccsc",
  acoth: "arccoth",
  asech: "arcsech",
  acsch: "arccsch",
  round: "round",
  sign: "sgn",
  trunc: "trunc",
  expm1: "expm1",
  log1p: "log1p",
  sigmoid: "sigmoid",
  erf: "erf",
  relu: "relu",
};

function funcToLatex(name: FuncName, arg: string): string {
  const rendered = FUNC_LATEX[name];
  if (rendered) return rendered(arg);
  const op = OPERATORNAME_LATEX[name];
  if (op) return `\\operatorname{${op}}(${arg})`;
  throw new Error(`No LaTeX rendering registered for function "${name}"`);
}

// atan2/hypot/lcm have no standard bare LaTeX command; min/max/gcd do.
const BINARY_FUNC_LATEX: Record<BinaryFuncName, string> = {
  atan2: "\\operatorname{atan2}",
  hypot: "\\operatorname{hypot}",
  min: "\\min",
  max: "\\max",
  gcd: "\\gcd",
  lcm: "\\operatorname{lcm}",
};

/** Renders a Symbolic Expr as LaTeX, mirroring mallory-math's own plain-infix `Symbolic.toString` renderer but targeting math markup (KaTeX) instead of a bare string. */
export function exprToLatex(expr: Expr, parentPrec = 0): string {
  switch (expr.type) {
    case "const":
      return `${expr.value}`;
    case "var":
      return expr.name;
    case "func":
      return funcToLatex(expr.name, exprToLatex(expr.arg, 0));
    case "call2":
      return `${BINARY_FUNC_LATEX[expr.name]}(${exprToLatex(expr.left, 0)}, ${exprToLatex(expr.right, 0)})`;
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
