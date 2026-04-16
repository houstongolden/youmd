import { describe, expect, it } from "vitest";
import { getMeUser, type MeResponse } from "../lib/api";

describe("getMeUser", () => {
  it("prefers nested user fields from the live /me response shape", () => {
    const me: MeResponse = {
      user: {
        username: "nested-user",
        email: "nested@example.com",
        displayName: "Nested User",
        plan: "pro",
        createdAt: 123,
      },
      latestBundle: null,
      publishedBundle: null,
      bundleCount: 0,
    };

    expect(getMeUser(me)).toEqual({
      username: "nested-user",
      email: "nested@example.com",
      displayName: "Nested User",
      plan: "pro",
      createdAt: 123,
    });
  });

  it("falls back to legacy flat fields for backward compatibility", () => {
    const me: MeResponse = {
      username: "flat-user",
      email: "flat@example.com",
      displayName: "Flat User",
      plan: "free",
      createdAt: 456,
      latestBundle: null,
      publishedBundle: null,
      bundleCount: 0,
    };

    expect(getMeUser(me)).toEqual({
      username: "flat-user",
      email: "flat@example.com",
      displayName: "Flat User",
      plan: "free",
      createdAt: 456,
    });
  });
});
