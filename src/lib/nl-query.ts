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
