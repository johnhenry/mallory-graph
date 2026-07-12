import { createFileRoute } from "@tanstack/react-router";
import { CalculatorPanel } from "~/components/CalculatorPanel.tsx";

export const Route = createFileRoute("/_app/calculator")({
  component: CalculatorPage,
});

function CalculatorPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Calculator</p>
        <h1>Just an answer.</h1>
        <p className="lede">Type an expression, get a result. Name a value to reuse it later.</p>
      </div>
      <CalculatorPanel />
    </div>
  );
}
