import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/tesla/crypto";

const KEY = "b".repeat(64);

describe("tesla crypto", () => {
  it("round-trips refresh token encryption", () => {
    const plain = "NA_refresh_token_example_12345";
    const encrypted = encryptSecret(plain, KEY);
    expect(encrypted).not.toContain(plain);
    expect(decryptSecret(encrypted, KEY)).toBe(plain);
  });

  it("rejects invalid encryption key length", () => {
    expect(() => encryptSecret("x", "short")).toThrow(/64 hex/);
  });
});
