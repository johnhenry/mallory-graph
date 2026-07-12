import { createFileRoute } from "@tanstack/react-router";
import { CategoryTabs } from "~/components/CategoryTabs.tsx";
import { GraphCanvasMulti } from "~/components/GraphCanvasMulti.tsx";
import { ImplicitPanel } from "~/components/ImplicitPanel.tsx";
import { ParametricPanel } from "~/components/ParametricPanel.tsx";

export const Route = createFileRoute("/_app/graphing")({
  component: GraphingPage,
});

function GraphingPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Graphing</p>
        <h1>Plot, compare, and animate curves.</h1>
        <p className="lede">Three modes over one shared canvas.</p>
      </div>
      <CategoryTabs
        prefix="graphing"
        tabs={[
          { label: "Multi-expression", render: () => <GraphCanvasMulti /> },
          { label: "Implicit", render: () => <ImplicitPanel /> },
          { label: "Parametric & Polar", render: () => <ParametricPanel /> },
        ]}
      />
    </div>
  );
}
