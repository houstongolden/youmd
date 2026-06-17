import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { mineReusablePatterns } from "../lib/reusable-patterns";

let tmpRoot: string | null = null;

function write(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function makeRoot(): string {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-patterns-"));
  return tmpRoot;
}

afterEach(() => {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

describe("mineReusablePatterns", () => {
  it("detects reusable UI, MCP, Convex, docs, auth, and brain-dump patterns from project files", () => {
    const root = makeRoot();

    write(path.join(root, "youmd", "package.json"), JSON.stringify({
      dependencies: { next: "16.0.0", react: "19.0.0", convex: "1.0.0" },
      scripts: { setup: "youmd machine prompt && youmd project portfolio-hydrate" },
    }));
    write(path.join(root, "youmd", "AGENTS.md"), "Default architecture is API/MCP + SkillStack-first with get_project_context.");
    write(path.join(root, "youmd", "project-context", "PRD.md"), "# PRD\n\nfeature-requests-active and PROMPTS.md stay current.");
    write(path.join(root, "youmd", "project-context", "TODO.md"), "# TODO\n");
    write(path.join(root, "youmd", "src", "app", "dashboard", "dashboard-content.tsx"), `
      const rightPane = "portfolio";
      // left sidebar, new chat, session intelligence, Portfolio Graph
      export function Dashboard() { return rightPane; }
    `);
    write(path.join(root, "youmd", "src", "hooks", "useYouAgent.ts"), `
      export const steps = ["acknowledging", "progress", "artifact"];
      export function stream() { return "streaming task list progress"; }
    `);
    write(path.join(root, "youmd", "convex", "http.ts"), `
      const TRUSTED_INTERNAL_AUTH_TOKEN = "redacted";
      await requireScope(ctx, request, auth, "write:bundle", "projects");
      await guardWrite(ctx, request, auth);
      await requireOwner(ctx, clerkId, _internalAuthToken);
      // brainDumpCaptures portfolioTasks /braindump /task ownerType
    `);
    write(path.join(root, "youmd", "cli", "src", "lib", "portfolio-audit.ts"), `
      export function normalizeKeyName() {}
      // env-audit portfolio-audit fingerprint secret values were not read
    `);
    write(path.join(root, "youmd", "cli", "src", "lib", "machine-bootstrap-prompt.ts"), `
      // /new computer CODE_YOU env vault portfolio graph resident sync
    `);

    write(path.join(root, "bamfaiapp", "package.json"), JSON.stringify({
      dependencies: { next: "16.0.0", react: "19.0.0" },
    }));
    write(path.join(root, "bamfaiapp", "src", "app", "auth", "login.tsx"), `
      // passwordless one-time code OTP magic link through Resend and Sendblue
    `);
    write(path.join(root, "bamfaiapp", "project-context", "CURRENT_STATE.md"), "CURRENT_STATE.md keeps agent state.");

    const result = mineReusablePatterns({
      root,
      projects: [
        { name: "youmd", path: "youmd", providers: ["Convex", "Resend"] },
        { name: "bamfaiapp", path: "bamfaiapp", providers: ["Resend", "Sendblue"] },
      ],
      maxFilesPerProject: 80,
    });

    const slugs = result.patterns.map((pattern) => pattern.slug);
    expect(slugs).toContain("api-mcp-skillstack-first");
    expect(slugs).toContain("agentic-shell-layout");
    expect(slugs).toContain("convex-owner-gated-api");
    expect(slugs).toContain("project-context-operating-docs");
    expect(slugs).toContain("first-party-passwordless-auth");
    expect(slugs).toContain("task-braindump-router");
    expect(slugs).toContain("env-provider-intelligence");
    expect(slugs).toContain("fresh-machine-bootstrap");
    expect(slugs).toContain("agent-streaming-progress");

    const shell = result.patterns.find((pattern) => pattern.slug === "agentic-shell-layout");
    expect(shell?.usageProjects).toEqual(["youmd"]);
    expect(shell?.sourcePaths.join("\n")).toContain("youmd:src/app/dashboard/dashboard-content.tsx");
    expect(JSON.stringify(result)).not.toContain("redacted\"");
  });
});
