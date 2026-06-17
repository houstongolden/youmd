import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMachineVerificationProof,
  buildMachineInstallReport,
  buildMachineReadinessReport,
  buildMachineRunChecksReport,
  buildMachineServerProbeReport,
  inspectMachineProject,
  writeMachineVerificationProof,
} from "../lib/machine-verify";

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-machine-verify-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("machine readiness verifier", () => {
  it("audits project readiness without reading env values", () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "youmd");
    fs.mkdirSync(path.join(projectDir, ".git"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, ".git", "config"),
      '[remote "origin"]\n\turl = https://github.com/houstongolden/youmd.git\n',
    );
    fs.writeFileSync(path.join(projectDir, "AGENTS.md"), "# agent docs\n");
    fs.writeFileSync(path.join(projectDir, ".env.example"), "OPENAI_API_KEY=\n");
    fs.writeFileSync(path.join(projectDir, ".env.local"), "OPENAI_API_KEY=secret-not-read\n");
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ scripts: { build: "next build", dev: "next dev", lint: "eslint" } }, null, 2),
    );
    fs.writeFileSync(path.join(projectDir, "package-lock.json"), "{}\n");

    const project = inspectMachineProject(projectDir);

    expect(project.status).toBe("ready");
    expect(project.remoteUrl).toBe("https://github.com/houstongolden/youmd.git");
    expect(project.packageManager).toBe("npm");
    expect(project.suggestedChecks).toEqual(["npm run lint", "npm run build", "npm run dev"]);
    expect(project.notes).not.toContain("env restore needed before full local run");
  });

  it("marks projects with env examples but no env local as needing env restore", () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "bamfaiapp");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, ".env.example"), "RESEND_API_KEY=\n");
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ scripts: { build: "next build" } }));

    const report = buildMachineReadinessReport(root);

    expect(report.scanned).toBe(1);
    expect(report.totals.needsEnv).toBe(1);
    expect(report.projects[0].status).toBe("needs-env");
    expect(report.projects[0].notes).toContain("env restore needed before full local run");
  });

  it("runs bounded opt-in package checks and reports pass/fail results", () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "checks");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "AGENTS.md"), "# agent docs\n");
    fs.writeFileSync(path.join(projectDir, "package-lock.json"), "{}\n");
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({
        scripts: {
          lint: "node -e \"console.log('lint ok')\"",
          build: "node -e \"console.error('build nope'); process.exit(2)\"",
        },
      }),
    );

    const report = buildMachineRunChecksReport(root, {
      scripts: ["lint", "build"],
      timeoutMs: 30_000,
      maxProjects: 1,
    });

    expect(report.totals.passed).toBe(1);
    expect(report.totals.failed).toBe(1);
    expect(report.results.map((result) => result.status)).toEqual(["passed", "failed"]);
    expect(report.results.find((result) => result.status === "failed")?.outputTail).toContain("build nope");
  });

  it("runs bounded dependency installs for package projects", () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "installable");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ scripts: { build: "node -e \"console.log('ok')\"" } }, null, 2),
    );

    const report = buildMachineInstallReport(root, {
      timeoutMs: 30_000,
      maxProjects: 1,
    });

    expect(report.totals.passed).toBe(1);
    expect(report.results[0].command).toBe("npm install");
  });

  it("smoke probes bounded local dev servers", async () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "server");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ scripts: { dev: "node server.js" } }, null, 2),
    );
    fs.writeFileSync(
      path.join(projectDir, "server.js"),
      [
        "const http = require('http');",
        "const port = Number(process.env.PORT || 4310);",
        "http.createServer((_req, res) => res.end('ok')).listen(port, '127.0.0.1');",
      ].join("\n"),
    );

    const report = await buildMachineServerProbeReport(root, {
      timeoutMs: 10_000,
      maxProjects: 1,
      startPort: 4390,
    });

    expect(report.totals.passed).toBe(1);
    expect(report.results[0].url).toBe("http://127.0.0.1:4390");
  });

  it("classifies non-interactive Convex setup blockers in server probe proof", async () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "youmd");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({
        scripts: {
          dev: "node fail-convex.js",
        },
      }, null, 2),
    );
    fs.writeFileSync(
      path.join(projectDir, "fail-convex.js"),
      [
        "console.error('> youmd@0.1.0 predev');",
        "console.error('> npx convex dev --until-success');",
        "console.error('Cannot prompt for input in non-interactive terminals. (What would you like to configure?)');",
        "process.exit(1);",
      ].join("\n"),
    );

    const servers = await buildMachineServerProbeReport(root, {
      timeoutMs: 10_000,
      maxProjects: 1,
      startPort: 4490,
    });
    const readiness = buildMachineReadinessReport(root);
    const proof = buildMachineVerificationProof({ readiness, servers });

    expect(servers.totals.failed).toBe(1);
    expect(servers.results[0].reason).toContain("non-interactive Convex setup required");
    expect(proof.summary.warnings).toContain(
      "youmd: non-interactive Convex setup required before dev server start; restore Convex/env config or run convex dev interactively once",
    );
  });

  it("writes a secret-safe machine proof report", () => {
    const root = makeTempRoot();
    const projectDir = path.join(root, "proof");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ scripts: { lint: "node -e \"console.log('ok')\"" } }));
    const readiness = buildMachineReadinessReport(root);
    const checks = buildMachineRunChecksReport(root, {
      scripts: ["lint"],
      timeoutMs: 30_000,
      maxProjects: 1,
    });
    checks.results[0].outputTail = "OPENAI_API_KEY=sk-secret-value";

    const proof = buildMachineVerificationProof({ readiness, checks, generatedAt: "2026-06-17T12:00:00.000Z" });
    const out = path.join(root, "proof.json");
    const written = writeMachineVerificationProof(proof, out);
    const raw = fs.readFileSync(written.latestPath, "utf-8");

    expect(written.archivedPath).toContain("machine-proof-2026-06-17T12-00-00-000Z.json");
    expect(raw).toContain("\"secretValuesExposed\": false");
    expect(raw).not.toContain("sk-secret-value");
    expect(raw).toContain("[redacted]");
  });
});
