import { describe, expect, it } from "vitest";
import { parseSignupCorrection } from "../commands/register";
import { isBackCommand } from "../lib/onboarding";

describe("sign-up correction commands (U14)", () => {
  it("parses back commands", () => {
    expect(parseSignupCorrection("back")).toBe("back");
    expect(parseSignupCorrection("/back")).toBe("back");
    expect(parseSignupCorrection("  Back  ")).toBe("back");
  });

  it("parses change-email commands", () => {
    expect(parseSignupCorrection("/email")).toBe("change-email");
    expect(parseSignupCorrection("change email")).toBe("change-email");
    expect(parseSignupCorrection("change-email")).toBe("change-email");
  });

  it("parses resend commands", () => {
    expect(parseSignupCorrection("resend")).toBe("resend");
    expect(parseSignupCorrection("/resend")).toBe("resend");
    expect(parseSignupCorrection("resend code")).toBe("resend");
  });

  it("returns null for regular answers", () => {
    expect(parseSignupCorrection("houston")).toBeNull();
    expect(parseSignupCorrection("houston@bamf.ai")).toBeNull();
    expect(parseSignupCorrection("123456")).toBeNull();
    expect(parseSignupCorrection("backstage crew")).toBeNull();
    expect(parseSignupCorrection("")).toBeNull();
  });

  it("isBackCommand matches only back / /back in onboarding", () => {
    expect(isBackCommand("back")).toBe(true);
    expect(isBackCommand("/back")).toBe(true);
    expect(isBackCommand("BACK")).toBe(true);
    expect(isBackCommand("backpack")).toBe(false);
    expect(isBackCommand("go back home")).toBe(false);
    expect(isBackCommand("")).toBe(false);
  });
});
