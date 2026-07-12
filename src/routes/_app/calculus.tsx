import { createFileRoute } from "@tanstack/react-router";
import { CategoryTabs } from "~/components/CategoryTabs.tsx";
import { OdePanel } from "~/components/OdePanel.tsx";
import { OdeSystemPanel } from "~/components/OdeSystemPanel.tsx";

export const Route = createFileRoute("/_app/calculus")({
  component: CalculusPage,
});

function CalculusPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">Calculus</p>
        <h1>Differential equations.</h1>
        <p className="lede">One equation, or a coupled system.</p>
      </div>
      <CategoryTabs
        tabs={[
          { label: "Single ODE", render: () => <OdePanel /> },
          { label: "ODE System", render: () => <OdeSystemPanel /> },
        ]}
      />
    </div>
  );
}
