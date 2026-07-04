/**
 * Thin natural-language-to-expression layer (Wolfram-Alpha-style input
 * forgiveness), distinct from a full conversational co-editing agent: a
 * query like "derivative of x^2 sin(x)" pattern-matches to a
 * Symbolic.parse + differentiate call and resolves to plain expression
 * source, without the user needing to write formal CAS syntax. Falls
 * through to null (treat the input as a normal expression) on anything
 * that doesn't match a known phrasing, or that fails to resolve.
 */
import { Symbolic } from "mallory-math";
import { equationToImplicitZero } from "./equation-to-zero.ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

interface QueryPattern {
  regex: RegExp;
  resolve: (match: RegExpMatchArray) => string;
}

const PATTERNS: QueryPattern[] = [
  {
    regex: /^\s*(?:the\s+)?derivative\s+of\s+(.+)$/i,
    resolve: (match) => Symbolic.toString(Symbolic.differentiate(preprocessImplicitMultiplication(match[1] as string))),
  },
  {
    regex: /^\s*d\s*\/\s*dx\s+(?:of\s+)?(.+)$/i,
    resolve: (match) => Symbolic.toString(Symbolic.differentiate(preprocessImplicitMultiplication(match[1] as string))),
  },
  {
    // Must come before the bare integral pattern below -- that one is greedy
    // (`.+`) and would otherwise swallow the "from...to" suffix as part of
    // the expression and fail, and the resolver loop doesn't fall through to
    // a later pattern once an earlier regex has matched.
    regex: /^\s*(?:the\s+)?(?:definite\s+)?(?:integral|antiderivative)\s+of\s+(.+?)\s+from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+)\s*$/i,
    resolve: (match) => {
      const inner = match[1] as string;
      const lower = Number(match[2]);
      const upper = Number(match[3]);
      return String(Symbolic.integrateDefinite(preprocessImplicitMultiplication(inner), lower, upper));
    },
  },
  {
    regex: /^\s*(?:the\s+)?(?:integral|antiderivative)\s+of\s+(.+)$/i,
    resolve: (match) => Symbolic.toString(Symbolic.integrate(preprocessImplicitMultiplication(match[1] as string))),
  },
  {
    regex: /^\s*simplify\s+(.+)$/i,
    resolve: (match) => Symbolic.toString(Symbolic.simplify(preprocessImplicitMultiplication(match[1] as string))),
  },
  {
    regex: /^\s*factor\s+(.+)$/i,
    resolve: (match) => Symbolic.toString(Symbolic.factor(preprocessImplicitMultiplication(match[1] as string))),
  },
  {
    regex: /^\s*expand\s+(.+)$/i,
    resolve: (match) => Symbolic.toString(Symbolic.expand(preprocessImplicitMultiplication(match[1] as string))),
  },
  {
    // "solve X" or "solve X for v" -- accepts "lhs = rhs" via the same
    // implicit-zero conversion the system-solver panel uses. Only resolves
    // when there's exactly one real root: multiple roots don't reduce to a
    // single plottable expression, and returning just the first would
    // silently discard the others, so this falls through to null instead.
    // The found root is numerically spot-checked via Symbolic.verifySolution
    // before being returned -- a CAS "reviewer" pass (see the research
    // roadmap): if the root doesn't actually zero the equation (a bug, or a
    // numerically-fragile symbolic result), this falls through to null
    // rather than silently plotting a wrong constant.
    regex: /^\s*solve\s+(.+?)(?:\s+for\s+(\w+))?\s*$/i,
    resolve: (match) => {
      const inner = equationToImplicitZero(preprocessImplicitMultiplication(match[1] as string));
      const variable = (match[2] as string | undefined) ?? "x";
      const roots = Symbolic.solve(inner, variable);
      if (roots.length !== 1) throw new Error("solve: ambiguous or no result for NL resolution");
      const candidate = Symbolic.evaluate(roots[0]);
      if (!Symbolic.verifySolution(inner, variable, candidate)) {
        throw new Error("solve: candidate root failed verification");
      }
      return Symbolic.toString(roots[0]);
    },
  },
  {
    // "limit of X as x approaches A" (also accepts "->"/"→", and
    // "infinity"/"-infinity" for A).
    regex:
      /^\s*(?:the\s+)?limit\s+of\s+(.+?)\s+as\s+(\w+)\s*(?:approaches|->|→)\s*(-?infinity|-?[\d.]+)\s*$/i,
    resolve: (match) => {
      const inner = preprocessImplicitMultiplication(match[1] as string);
      const variable = match[2] as string;
      const pointText = (match[3] as string).toLowerCase();
      const point = pointText === "infinity" ? Infinity : pointText === "-infinity" ? -Infinity : Number(pointText);
      return String(Symbolic.limit(inner, variable, point));
    },
  },
];

/** Resolves a natural-language query to plain expression source, or null if `input` doesn't match a known phrasing (or fails to resolve). */
export function resolveNaturalLanguageQuery(input: string): string | null {
  for (const { regex, resolve } of PATTERNS) {
    const match = input.match(regex);
    if (!match) continue;
    try {
      return resolve(match);
    } catch {
      return null;
    }
  }
  return null;
}
