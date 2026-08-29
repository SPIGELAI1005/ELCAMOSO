let relaySessionId: string | null = null;

export function setClientRelaySessionId(sessionId: string | null): void {
  relaySessionId = sessionId;
}

export function readClientRelaySessionId(): string | null {
  return relaySessionId;
}

export function resetClientRelaySessionIdForTests(): void {
  relaySessionId = null;
}
