import { createFileRoute } from "@tanstack/react-router";
import { Linked3DView } from "~/components/Linked3DView.tsx";

export const Route = createFileRoute("/_app/3d")({
  component: ThreeDPage,
});

function ThreeDPage() {
  return (
    <div>
      <div className="page-head">
        <p className="page-eyebrow">3D &amp; Surfaces</p>
        <h1>z = f(x, y)</h1>
        <p className="lede">A 2D curve and a 3D surface, sharing one reactive core.</p>
      </div>
      <Linked3DView />
    </div>
  );
}
