/** Client drive session id - one per browser tab, used for trial and Tesla upgrade linking. */
export function readClientDriveSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "elcamoso.driveSessionId";
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

export function resetClientDriveSessionIdForTests(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem("elcamoso.driveSessionId");
}
