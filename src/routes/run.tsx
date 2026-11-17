import { createFileRoute, redirect } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";

/** Alias of /rumoso. Non-admins see the coming-soon page there; admins get the app. */
export const Route = createFileRoute("/run")({
  beforeLoad: () => {
    throw redirect({ to: "/rumoso" });
  },
  head: () => createSeoHeadFromPath("/run"),
});
