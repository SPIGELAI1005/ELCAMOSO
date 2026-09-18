import type { Entitlement } from "@/lib/entitlements/types";
import type { ExperienceDescriptor } from "./types";

export function canAccessExperience(
  experience: ExperienceDescriptor,
  hasEntitlement: (entitlement: Entitlement) => boolean,
): boolean {
  if (experience.entitlement === "coming") return false;
  const required = experience.capabilities.requiredEntitlement;
  return required ? hasEntitlement(required) : experience.entitlement === "free";
}
