import { createFileRoute } from "@tanstack/react-router";
import { CategoryTabs } from "~/components/CategoryTabs.tsx";
import { RegressionPanel } from "~/components/RegressionPanel.tsx";
import { StatisticsPanel } from "~/components/StatisticsPanel.tsx";
import { SystemSolverPanel } from "~/components/SystemSolverPanel.tsx";

export const Route = createFileRoute("/_app/data")({
  component: DataPage,
});

function DataPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Data &amp; Algebra</p>
        <h1>Fit, describe, solve.</h1>
        <p className="lede">Regression, statistics, and equation systems.</p>
      </div>
      <CategoryTabs
        tabs={[
          { label: "Regression", render: () => <RegressionPanel /> },
          { label: "Statistics", render: () => <StatisticsPanel /> },
          { label: "Systems", render: () => <SystemSolverPanel /> },
        ]}
      />
    </div>
  );
}
