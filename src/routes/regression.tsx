import { createFileRoute, Link } from "@tanstack/react-router";
import { RegressionPanel } from "../components/RegressionPanel.tsx";

export const Route = createFileRoute("/regression")({
  component: RegressionPage,
});

function RegressionPage() {
  return (
    <div>
      <h1>mallory-graph — regression</h1>
      <p>
        Linear regression (least squares) over a pasted (x, y) data set via <code>mallory-math</code>'s{" "}
        <code>Statistics.linearRegression</code>/<code>correlation</code> — previously fully implemented upstream but
        unused anywhere in the UI. v1 is linear only; a nonlinear (Levenberg–Marquardt) fit is a later CAS-side
        addition.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <RegressionPanel />
    </div>
  );
}
