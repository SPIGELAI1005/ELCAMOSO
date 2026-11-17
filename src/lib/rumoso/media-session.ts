/** Media Session metadata so a lock-screen widget can keep the session alive. */

export function publishRumosoMediaSession(handlers: {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}): () => void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return () => {};
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title: "RUMOSO",
      artist: "ELCAMOSO",
      album: "Running Motion Sound",
    });
    ms.playbackState = "playing";
    const bind = (action: MediaSessionAction, fn?: () => void) => {
      try {
        if (fn) ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    };
    bind("play", handlers.onPlay);
    bind("pause", handlers.onPause);
    bind("stop", handlers.onStop);
  } catch {
    /* some WebViews throw on MediaMetadata */
  }
  return () => {
    try {
      ms.playbackState = "none";
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("stop", null);
    } catch {
      /* ignore */
    }
  };
}

export function setRumosoPlaybackState(state: MediaSessionPlaybackState): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    /* ignore */
  }
}
