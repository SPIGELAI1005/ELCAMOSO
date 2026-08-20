import { createFileRoute } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About — ELCAMOSO" },
      {
        name: "description",
        content:
          "ELCAMOSO is a motion-to-sound platform for electric vehicles. Electric Car Motion Sound.",
      },
      { property: "og:title", content: "About — ELCAMOSO" },
      {
        property: "og:description",
        content: "ELCAMOSO is a motion-to-sound platform for electric vehicles.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
});

function About() {
  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-2xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Your EV. Your sound.</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          ELCAMOSO is a motion-to-sound platform for electric vehicles. Speed, acceleration
          and deceleration from your phone are translated in real time into a sound profile
          that belongs to the movement of the car — not to a button press.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Profiles can behave like a virtual transmission or rise continuously with motion,
          so the platform is not limited to combustion simulation. Turbine, cinematic and
          manufacturer-designed EV signatures all fit the same model.
        </p>
        <p className="mt-10 text-xs tracking-[0.28em] text-muted-foreground uppercase">
          ELCAMOSO — Electric Car Motion Sound
        </p>
        <p className="mt-10 text-sm text-muted-foreground">
          Your drive stays yours. Motion data is processed on this device only.
        </p>
      </div>
    </main>
  );
}
