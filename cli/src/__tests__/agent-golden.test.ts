/**
 * agent-golden.test.ts — L7 golden Q&A eval suite.
 *
 * Each fixture verifies that the You Agent system prompt assembly includes
 * required identity-context fields. No live LLM calls — all assertions are
 * against the output of buildWhoamiSummaryFromYouJson (the CLI-side prompt
 * builder exported from cli/src/mcp/server.ts).
 *
 * If an identity-context field goes missing from the builder, at least one
 * fixture here will fail, giving an early signal before it reaches users.
 */

import { describe, expect, it } from "vitest";
import { buildWhoamiSummaryFromYouJson } from "../mcp/server";

// ─── Fixture corpus ───────────────────────────────────────────────────────────

const BASE_YOU_JSON: Record<string, unknown> = {
  identity: {
    name: "Houston Golden",
    tagline: "founder, you.md",
    location: "Miami",
    bio: { short: "growth pioneer" },
  },
  preferences: {
    agent: { tone: "direct, no fluff", avoid: ["corporate speak", "emoji"] },
  },
  agent_directives: {
    default_stack: "next.js + convex",
    current_goal: "ship the identity protocol",
  },
  projects: [
    { name: "you.md", status: "active" },
    { name: "hubify" },
    "bamf.ai",
    { name: "fourth-should-be-dropped" },
  ],
  values: ["speed"],
  voice: { style: "dry" },
  links: { github: "https://github.com/houstongolden" },
  now: { focus: ["you.md launch"] },
  meta: { version: "you-md/v1" },
};

interface GoldenFixture {
  question: string;
  mustContain: string[];
}

const FIXTURES: GoldenFixture[] = [
  {
    question: "Who am I talking to?",
    mustContain: ["Name: Houston Golden"],
  },
  {
    question: "What is this person's professional role?",
    mustContain: ["Role: founder, you.md"],
  },
  {
    question: "What tech stack does this person prefer?",
    mustContain: ["Stack: next.js + convex"],
  },
  {
    question: "How should the agent communicate?",
    mustContain: ["Tone: direct, no fluff", "Avoid: corporate speak"],
  },
  {
    question: "What are the top projects?",
    mustContain: ["Top projects: you.md, hubify, bamf.ai"],
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("You Agent golden Q&A — system prompt assembly", () => {
  const summary = buildWhoamiSummaryFromYouJson(BASE_YOU_JSON);

  for (const fixture of FIXTURES) {
    it(fixture.question, () => {
      for (const phrase of fixture.mustContain) {
        expect(summary).toContain(phrase);
      }
    });
  }

  it("summary is within the 500-char agent budget", () => {
    expect(summary.length).toBeLessThanOrEqual(500);
  });

  it("summary falls back to username when identity.name is absent", () => {
    const fallback = buildWhoamiSummaryFromYouJson({ username: "anon" });
    expect(fallback).toContain("Name: anon");
  });
});
