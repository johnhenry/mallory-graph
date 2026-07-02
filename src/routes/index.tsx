import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const evaluateProof = createServerFn({ method: "GET" }).handler(async () => {
  const { StringEvaluator } = await import("mallory-ts");
  const result = StringEvaluator.evaluate(
    "sin(pi/2) + 2^3",
    StringEvaluator.mathEnvironment(),
  );
  return { result: Number(result) };
});

export const Route = createFileRoute("/")({
  loader: () => evaluateProof(),
  component: HomePage,
});

function HomePage() {
  const { result } = Route.useLoaderData();
  return (
    <div>
      <h1>mallory-graph</h1>
      <p>
        Computed server-side via mallory-ts:{" "}
        <code>StringEvaluator.evaluate("sin(pi/2) + 2^3", ...)</code> ={" "}
        <strong>{result}</strong>
      </p>
    </div>
  );
}
