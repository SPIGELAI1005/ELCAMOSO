import { useEffect } from "react";

import { useAccount } from "@/lib/account/AccountProvider";
import { readSettings } from "@/lib/drive/settings";
import { installId } from "@/lib/telemetry/analytics";

const KEY = "elcamoso.account.deviceLinked.v1";

/**
 * When signed in AND Usage insights is on, link this device's anonymous install id to the
 * account (at most once a day per account). Nothing happens when signed out or opted out.
 */
export function DeviceLinkBridge() {
  const { session, isAuthenticated } = useAccount();
  useEffect(() => {
    if (!isAuthenticated || !session?.userId) return;
    try {
      if (!readSettings().analyticsEnabled) return;
      const mark = `${session.userId}:${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(KEY) === mark) return;
      void fetch("/api/account/link-device", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installId: installId() }),
      })
        .then((r) => r.json())
        .then((b: { linked?: boolean }) => {
          if (b.linked) localStorage.setItem(KEY, mark);
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
  }, [isAuthenticated, session?.userId]);
  return null;
}
