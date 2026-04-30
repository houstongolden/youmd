export interface FirstRunState {
  authed: boolean;
  hasBundle: boolean;
}

export type FirstRunAction =
  | "login"
  | "register"
  | "pull"
  | "init"
  | "status"
  | "help"
  | "quit";

export interface FirstRunPlan {
  headline: string;
  detail: string;
  defaultAction: FirstRunAction;
  suggestedActions: FirstRunAction[];
}

function normalize(input: string): string {
  return input.toLowerCase().trim().replace(/[.!?]+$/g, "");
}

function includesAny(input: string, patterns: string[]): boolean {
  return patterns.some((pattern) => input.includes(pattern));
}

export function getFirstRunPlan(state: FirstRunState): FirstRunPlan | null {
  if (state.hasBundle) return null;

  if (!state.authed) {
    return {
      headline: "i can get you live in one move.",
      detail:
        "login gets the machine connected. register is for a brand-new identity.",
      defaultAction: "login",
      suggestedActions: ["login", "register", "status", "help", "quit"],
    };
  }

  return {
    headline: "you're signed in. now i need a local bundle to work with.",
    detail:
      "pull grabs your live identity if you already have one. init builds a fresh local bundle.",
    defaultAction: "pull",
    suggestedActions: ["pull", "init", "status", "help", "quit"],
  };
}

export function parseFirstRunAction(
  input: string,
  state: FirstRunState,
): FirstRunAction | null {
  const value = normalize(input);
  if (!value) return null;

  if (
    value === "q" ||
    value === "quit" ||
    value === "exit" ||
    value === "stop" ||
    value === "later"
  ) {
    return "quit";
  }

  if (
    value === "help" ||
    value === "commands" ||
    value === "--help" ||
    value === "-h"
  ) {
    return "help";
  }

  if (value === "status" || value === "check status" || value === "check") {
    return "status";
  }

  if (!state.authed) {
    if (
      includesAny(value, [
        "register",
        "sign up",
        "signup",
        "create account",
        "new account",
        "new identity",
      ])
    ) {
      return "register";
    }

    if (
      includesAny(value, [
        "login",
        "log in",
        "sign in",
        "browser",
        "email code",
        "connect",
        "start",
        "go",
      ])
    ) {
      return "login";
    }
  }

  if (state.authed && !state.hasBundle) {
    if (
      includesAny(value, [
        "pull",
        "download",
        "fetch",
        "sync",
        "grab live",
        "live bundle",
      ])
    ) {
      return "pull";
    }

    if (
      includesAny(value, [
        "init",
        "initialize",
        "build",
        "fresh",
        "new bundle",
        "start local",
      ])
    ) {
      return "init";
    }
  }

  return null;
}
