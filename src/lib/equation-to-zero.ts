/**
 * Converts a user-typed equation like "2*x + 3*y = 12" into the "expr
 * implicitly equals zero" form `Symbolic.solveSystem` expects
 * ("(2*x + 3*y)-(12)"), by splitting on the first standalone "=" (not part
 * of "==", "!=", "<=", ">="). If no standalone "=" is found, the text is
 * returned unchanged -- either it's already in implicit-zero form, or it's
 * malformed and `Symbolic.parse` can surface that error itself.
 */
export function equationToImplicitZero(text: string): string {
  const idx = findBareEquals(text);
  if (idx === -1) return text;
  return `(${text.slice(0, idx)})-(${text.slice(idx + 1)})`;
}

function findBareEquals(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "=") continue;
    const prev = text[i - 1];
    const next = text[i + 1];
    if (prev === "=" || prev === "!" || prev === "<" || prev === ">" || next === "=") continue;
    return i;
  }
  return -1;
}
