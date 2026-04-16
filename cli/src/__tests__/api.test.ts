import { afterEach, describe, expect, it, vi } from "vitest";
import { getMeUser, getPublicProfile, type MeResponse } from "../lib/api";

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

describe("getPublicProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses vendor +json profile responses and wraps flat payloads", async () => {
    const payload = {
      schema: "you-md/v1",
      username: "vendor-user",
      identity: {
        name: "Vendor User",
      },
      _profile: {
        displayName: "Vendor User",
      },
      youMd: "# Vendor User",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.you-md.v1+json",
          },
        })
      )
    );

    await expect(getPublicProfile("vendor-user")).resolves.toEqual({
      youJson: {
        schema: "you-md/v1",
        username: "vendor-user",
        identity: {
          name: "Vendor User",
        },
        youMd: "# Vendor User",
      },
      youMd: "# Vendor User",
      username: "vendor-user",
      displayName: "Vendor User",
    });
  });
});
