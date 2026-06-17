import { describe, expect, it } from "vitest";

import { synthesizeProjectStrategy } from "../lib/project-strategy";

describe("synthesizeProjectStrategy", () => {
  it("extracts strategic project fields from docs and activity without leaking secrets", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "You.md",
      stackName: "YouStack",
      providers: ["OpenAI", "Sendblue"],
      shippedToday: 1,
      shipped7d: 5,
      shipped30d: 12,
      recentActivityTitles: ["Exported portfolio graph snapshots", "Added project task triage"],
      docs: {
        readme: `
# You.md

You.md is the identity context protocol for the agent internet.

## Vision
Every authorized agent starts with the right human, project, machine, skill, and dependency context.

## Pain Points
- Agents forget project context.
- Cross-project APIs drift into duplicates.

## Solution
Persist a portable portfolio graph that agents can read before adding APIs, tasks, or skills.

## Constraints
- Never print OPENAI_API_KEY=sk_test_should_not_leak_1234567890 in docs or repo snapshots.

## Not Building
- A generic CRM.

## Competitors
- [Notion](https://notion.so) - workspace docs, not agent-native context.
`,
        prd: `
## Success Metrics
- Time from fresh machine to useful project context.

## Audience
Houston and trusted local agents.
`,
      },
    });

    expect(strategy.vision).toContain("Every authorized agent starts");
    expect(strategy.painPoints).toContain("Agents forget project context.");
    expect(strategy.solution).toContain("Persist a portable portfolio graph");
    expect(strategy.audience).toContain("Houston and trusted local agents");
    expect(strategy.metrics).toContain("Time from fresh machine to useful project context.");
    expect(strategy.metrics).toContain("Shipping activity tracked: 1 today / 5 in 7d / 12 in 30d.");
    expect(strategy.constraints?.join("\n")).toContain("OPENAI_API_KEY=[REDACTED_SECRET]");
    expect(JSON.stringify(strategy)).not.toContain("sk_test");
    expect(strategy.notBuilding).toContain("A generic CRM.");
    expect(strategy.competitors?.[0]).toMatchObject({
      name: "Notion",
      url: "https://notion.so",
      note: "workspace docs, not agent-native context.",
    });
  });

  it("skips install/setup boilerplate when choosing fallback strategy text", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "BAMF Site",
      stackName: "BAMFOSStack",
      docs: {
        readme: `
# BAMF Site

Requires **Node.js 18** or higher. If you have nvm installed, run nvm use to switch versions.

BAMF Site is the agency operating system for admin workflows, client portals, and protected business automation.
`,
      },
      shippedToday: 0,
      shipped7d: 0,
      shipped30d: 0,
    });

    expect(strategy.vision).toContain("agency operating system");
    expect(strategy.solution).toContain("agency operating system");
    expect(JSON.stringify(strategy)).not.toContain("Requires **Node.js 18**");
  });

  it("does not use setup-script or tech-stack sections as solution fallback", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "Bad App",
      stackName: "BadStack",
      docs: {
        readme: `
# Bad App

Make sure the setup script is executable, then run it to install dependencies.

Bad App is a chat-first fitness, endurance, health, recovery, and accountability app.

## Architecture
- Framework: Next.js 16
- Styling: Tailwind CSS
`,
      },
    });

    expect(strategy.vision).toContain("chat-first fitness");
    expect(strategy.solution).toContain("chat-first fitness");
    expect(JSON.stringify(strategy)).not.toContain("setup script");
    expect(JSON.stringify(strategy)).not.toContain("Framework: Next.js");
  });

  it("skips .env setup copy instead of promoting it to project strategy", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "BAMF Site",
      stackName: "BAMFOSStack",
      docs: {
        readme: `
# BAMF Site

Copy .env.example to .env and add your Supabase credentials before running the app.

## Overview
BAMF Site is the proprietary BAMF operating system for agency workflows, admin agents, and protected business context.
`,
      },
    });

    expect(strategy.vision).toContain("proprietary BAMF operating system");
    expect(strategy.solution).toContain("proprietary BAMF operating system");
    expect(JSON.stringify(strategy)).not.toContain("Copy .env.example");
  });

  it("uses the local-audit fallback when docs only contain preview boilerplate", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "BAMF Site",
      stackName: "BAMFOSStack",
      fallbackSummary: "Local portfolio auditor found bamfsite at bamfsite/bamfsite using Supabase, Resend, Vercel.",
      docs: {
        readme: `
# BAMF Site

Cursor will expose this on a Preview/Web tab (e.g. http://localhost:5173).
`,
      },
    });

    expect(strategy.vision).toContain("Local portfolio auditor found bamfsite");
    expect(strategy.solution).toContain("Local portfolio auditor found bamfsite");
    expect(JSON.stringify(strategy)).not.toContain("localhost:5173");
  });

  it("prefers project-context overview over README build instructions", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "BAMF Site",
      stackName: "BAMFOSStack",
      docs: {
        readme: `
# BAMF Site

## Build
Compile the app for production.
`,
        overview: `
# BAMF Site Project Context

## Product Surface
BAMF.com is the public website plus the private BAMF OS admin, client portal, API, MCP, and agency brain control plane.
`,
      },
    });

    expect(strategy.vision).toContain("private BAMF OS admin");
    expect(strategy.solution).toContain("private BAMF OS admin");
    expect(JSON.stringify(strategy)).not.toContain("Compile the app");
  });

  it("matches numbered PRD headings like 1. Vision", () => {
    const strategy = synthesizeProjectStrategy({
      projectName: "You.md",
      stackName: "YouStack",
      docs: {
        readme: "You.md is the portable agent brain.",
        prd: `
# You.md Product Requirements Document

## 1. Vision
You.md is your agent brain, personal API/MCP, and named expertise stack layer for the agent internet.
`,
      },
    });

    expect(strategy.vision).toContain("personal API/MCP");
  });
});
