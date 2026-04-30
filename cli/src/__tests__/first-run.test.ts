import { describe, expect, it } from "vitest";
import { getFirstRunPlan, parseFirstRunAction } from "../lib/first-run";

describe("first-run guidance", () => {
  it("defaults to login when auth and bundle are both missing", () => {
    const plan = getFirstRunPlan({ authed: false, hasBundle: false });
    expect(plan?.defaultAction).toBe("login");
    expect(plan?.suggestedActions).toContain("register");
  });

  it("defaults to pull when auth exists but bundle is missing", () => {
    const plan = getFirstRunPlan({ authed: true, hasBundle: false });
    expect(plan?.defaultAction).toBe("pull");
    expect(plan?.suggestedActions).toContain("init");
  });

  it("returns no setup plan once a bundle exists", () => {
    expect(getFirstRunPlan({ authed: true, hasBundle: true })).toBeNull();
    expect(getFirstRunPlan({ authed: false, hasBundle: true })).toBeNull();
  });

  it("maps auth-stage phrases to login and register", () => {
    expect(parseFirstRunAction("sign in", { authed: false, hasBundle: false })).toBe("login");
    expect(parseFirstRunAction("create account", { authed: false, hasBundle: false })).toBe("register");
  });

  it("maps bundle-stage phrases to pull and init", () => {
    expect(parseFirstRunAction("download my live bundle", { authed: true, hasBundle: false })).toBe("pull");
    expect(parseFirstRunAction("start local", { authed: true, hasBundle: false })).toBe("init");
  });

  it("supports shared utility commands", () => {
    expect(parseFirstRunAction("help", { authed: false, hasBundle: false })).toBe("help");
    expect(parseFirstRunAction("check status", { authed: true, hasBundle: false })).toBe("status");
    expect(parseFirstRunAction("later", { authed: true, hasBundle: false })).toBe("quit");
  });
});
