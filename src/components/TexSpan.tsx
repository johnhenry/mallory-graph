import katex from "katex";
import "katex/dist/katex.min.css";

/** Renders a LaTeX string via KaTeX. `tex` is app-generated (see expr-to-latex.ts), never raw user input. */
export function TexSpan({ tex, className }: { tex: string; className?: string }) {
  const html = katex.renderToString(tex, { throwOnError: false });
  // eslint-disable-next-line react/no-danger
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
