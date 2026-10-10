import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy deep link: About content now lives on Story under the About menu. */
export const Route = createFileRoute("/about")({
  beforeLoad: () => {
    throw redirect({ to: "/story" });
  },
});
