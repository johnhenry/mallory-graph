import { FUNCTION_NAMES } from "mallory-math";

/**
 * Inserts explicit `*` at adjacency boundaries so expressions like `2x sin(x)`
 * parse the same way they would in Desmos/GeoGebra, before the string ever
 * reaches Symbolic.parse (whose grammar requires an explicit `*` between
 * factors). Known names are seeded from Symbolic's own `FUNCTION_NAMES` export
 * (every unary/binary function name and alias it recognizes) plus the
 * `pi`/`e` constants its own parser special-cases — not StringEvaluator's
 * environment, since this preprocessor only feeds the Symbolic fast path.
 * Unrecognized multi-letter runs (`xy`) split into single-char variables
 * multiplied together, matching GeoGebra/Desmos convention.
 */

interface KnownName {
  name: string;
  callable: boolean;
}

const KNOWN_NAMES: KnownName[] = [
  ...FUNCTION_NAMES.map((name) => ({ name, callable: true })),
  { name: "pi", callable: false },
  { name: "e", callable: false },
].sort((a, b) => b.name.length - a.name.length);

type Token =
  | { kind: "num"; text: string }
  | { kind: "ident"; text: string; callable: boolean }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "op"; text: string };

function tokenize(source: string): Token[] {
  const s = source.replace(/\s+/g, "");
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < s.length) {
    const rest = s.slice(pos);
    const ch = rest[0];
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      pos++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      pos++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      pos++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      tokens.push({ kind: "op", text: ch });
      pos++;
      continue;
    }
    const numMatch = /^\d+\.?\d*(?:[eE][+-]?\d+)?/.exec(rest);
    if (numMatch) {
      tokens.push({ kind: "num", text: numMatch[0] });
      pos += numMatch[0].length;
      continue;
    }
    if (/^[a-zA-Z_]/.test(rest)) {
      const known = KNOWN_NAMES.find((k) => rest.startsWith(k.name));
      if (known) {
        tokens.push({ kind: "ident", text: known.name, callable: known.callable });
        pos += known.name.length;
      } else {
        tokens.push({ kind: "ident", text: rest[0] as string, callable: false });
        pos += 1;
      }
      continue;
    }
    throw new Error(`Unexpected character at ${pos}: ${ch}`);
  }
  return tokens;
}

function needsMultiplication(left: Token, right: Token): boolean {
  const leftEndsFactor = left.kind === "num" || left.kind === "ident" || left.kind === "rparen";
  const rightStartsFactor = right.kind === "num" || right.kind === "ident" || right.kind === "lparen";
  if (!leftEndsFactor || !rightStartsFactor) return false;
  if (left.kind === "ident" && left.callable && right.kind === "lparen") return false; // function call, e.g. sin(
  return true;
}

function tokenText(t: Token): string {
  switch (t.kind) {
    case "lparen":
      return "(";
    case "rparen":
      return ")";
    case "comma":
      return ",";
    case "op":
      return t.text;
    case "num":
      return t.text;
    case "ident":
      return t.text;
  }
}

export function preprocessImplicitMultiplication(source: string): string {
  const tokens = tokenize(source);
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    if (i > 0 && needsMultiplication(tokens[i - 1] as Token, tokens[i] as Token)) out += "*";
    out += tokenText(tokens[i] as Token);
  }
  return out;
}
