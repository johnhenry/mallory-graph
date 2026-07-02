/**
 * Thin natural-language-to-expression layer (Wolfram-Alpha-style input
 * forgiveness), distinct from a full conversational co-editing agent: a
 * query like "derivative of x^2 sin(x)" pattern-matches to a
 * Symbolic.parse + differentiate call and resolves to plain expression
 * source, without the user needing to write formal CAS syntax. Falls
 * through to null (treat the input as a normal expression) on anything
 * that doesn't match a known phrasing, or that fails to resolve.
 */
import { Symbolic } from "mallory-ts";
import { preprocessImplicitMultiplication } from "./implicit-mult.ts";

interface QueryPattern {
  regex: RegExp;
  resolve: (inner: string) => string;
}

const PATTERNS: QueryPattern[] = [
  {
    regex: /^\s*(?:the\s+)?derivative\s+of\s+(.+)$/i,
    resolve: (inner) => Symbolic.toString(Symbolic.differentiate(preprocessImplicitMultiplication(inner))),
  },
  {
    regex: /^\s*d\s*\/\s*dx\s+(?:of\s+)?(.+)$/i,
    resolve: (inner) => Symbolic.toString(Symbolic.differentiate(preprocessImplicitMultiplication(inner))),
  },
  {
    regex: /^\s*(?:the\s+)?(?:integral|antiderivative)\s+of\s+(.+)$/i,
    resolve: (inner) => Symbolic.toString(Symbolic.integrate(preprocessImplicitMultiplication(inner))),
  },
  {
    regex: /^\s*simplify\s+(.+)$/i,
    resolve: (inner) => Symbolic.toString(Symbolic.simplify(preprocessImplicitMultiplication(inner))),
  },
];

/** Resolves a natural-language query to plain expression source, or null if `input` doesn't match a known phrasing (or fails to resolve). */
export function resolveNaturalLanguageQuery(input: string): string | null {
  for (const { regex, resolve } of PATTERNS) {
    const match = input.match(regex);
    if (!match) continue;
    try {
      return resolve(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}
