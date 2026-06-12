import { describe, expect, it } from "vitest";
import { detectWrapUpOffer, isDoneIntent } from "../lib/onboarding";

describe("onboarding done-phrase detection (U2)", () => {
  it("does not treat bare 'no' mid-flow as done", () => {
    expect(isDoneIntent("no", false)).toBe(false);
    expect(isDoneIntent("nope", false)).toBe(false);
    expect(isDoneIntent("nah", false)).toBe(false);
  });

  it("treats bare 'yes' after a wrap-up offer as done", () => {
    expect(isDoneIntent("yes", true)).toBe(true);
    expect(isDoneIntent("yeah", true)).toBe(true);
    expect(isDoneIntent("yep", true)).toBe(true);
  });

  it("treats 'i'm done' as done anytime", () => {
    expect(isDoneIntent("i'm done", false)).toBe(true);
    expect(isDoneIntent("i'm done", true)).toBe(true);
    expect(isDoneIntent("im done", false)).toBe(true);
  });

  it("does not treat 'ready' as done when answering a question", () => {
    expect(isDoneIntent("ready", false)).toBe(false);
  });

  it("treats 'ready' as done after a wrap-up offer", () => {
    expect(isDoneIntent("ready", true)).toBe(true);
  });

  it("does not treat bare acks as done mid-flow", () => {
    expect(isDoneIntent("yes", false)).toBe(false);
    expect(isDoneIntent("ok", false)).toBe(false);
    expect(isDoneIntent("sure", false)).toBe(false);
    expect(isDoneIntent("looks good", false)).toBe(false);
  });

  it("treats explicit phrases as done regardless of offer state", () => {
    expect(isDoneIntent("that's everything", false)).toBe(true);
    expect(isDoneIntent("that's all", false)).toBe(true);
    expect(isDoneIntent("publish", false)).toBe(true);
    expect(isDoneIntent("ship it", false)).toBe(true);
    expect(isDoneIntent("nothing else", false)).toBe(true);
  });

  it("ignores trailing punctuation on acks after an offer", () => {
    expect(isDoneIntent("yes.", true)).toBe(true);
    expect(isDoneIntent("ready!", true)).toBe(true);
  });

  it("does not treat substantive answers as done", () => {
    expect(isDoneIntent("yes i also run a podcast about ai", false)).toBe(
      false
    );
    expect(isDoneIntent("ready player one is my favorite book", false)).toBe(
      false
    );
    expect(isDoneIntent("", false)).toBe(false);
    expect(isDoneIntent("", true)).toBe(false);
  });

  it("detects wrap-up offers in agent messages", () => {
    expect(
      detectWrapUpOffer("your bundle is looking solid — ready to publish?")
    ).toBe(true);
    expect(detectWrapUpOffer("want to wrap up here, or keep going?")).toBe(
      true
    );
    expect(detectWrapUpOffer("i think we can call it done.")).toBe(true);
  });

  it("does not detect wrap-up offers in normal questions", () => {
    expect(detectWrapUpOffer("what are you focused on right now?")).toBe(
      false
    );
    expect(
      detectWrapUpOffer("ready for the next one? tell me about your values.")
    ).toBe(false);
    expect(detectWrapUpOffer("")).toBe(false);
  });
});
