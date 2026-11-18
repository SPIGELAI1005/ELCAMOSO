import { createRoot } from "react-dom/client";
import { RumosoApp, type RumosoDemoView } from "@/components/rumoso/RumosoApp";
import "@/styles.css";

const raw = new URLSearchParams(window.location.search).get("demo");
const demo: RumosoDemoView | undefined =
  raw === "ready" || raw === "running" || raw === "summary" || raw === "diagnostics" ? raw : undefined;

document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(
  <RumosoApp accessEmail="dev@localhost" dev {...(demo ? { demo } : {})} />,
);
