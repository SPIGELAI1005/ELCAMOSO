import { useNavigate } from "@tanstack/react-router";
import { useSettings } from "@/lib/drive/useSettings";

/** Select a Sound Profile and go straight to the Drive page. */
export function useTryProfile() {
  const { update } = useSettings();
  const navigate = useNavigate();
  return (profileId: string) => {
    update({ profileId });
    void navigate({ to: "/drive" });
  };
}
