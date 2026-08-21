import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: LegalLayout,
});

function LegalLayout() {
  return <Outlet />;
}
