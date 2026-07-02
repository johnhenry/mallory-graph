import { createFileRoute, Link } from "@tanstack/react-router";
import { LinkedGraphPanes } from "../components/LinkedGraphPanes.tsx";

export const Route = createFileRoute("/linked")({
  component: LinkedPage,
});

function LinkedPage() {
  return (
    <div>
      <h1>mallory-graph — linked panes</h1>
      <p>
        Two panes, one shared clock: play or scrub the left pane's timeline and both curves advance together.
      </p>
      <p>
        <Link to="/">← back</Link>
      </p>
      <LinkedGraphPanes />
    </div>
  );
}
