import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("project context detection", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-project-context-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Audit 2026-06-11 PRODUCT-AUDIT #41: detection is nearest-marker-wins by
  // depth. A marker in cwd (any kind) defines the project root; higher-up
  // markers — including .git — only apply when no nearer marker exists.
  it("nearest marker wins: a package.json in cwd beats the parent git root", async () => {
    const repo = path.join(tmpDir, "youmd");
    const nested = path.join(repo, "cli");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.mkdirSync(path.join(repo, "project-context"), { recursive: true });
    fs.writeFileSync(path.join(repo, "AGENTS.md"), "# instructions\n");
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "youmd" }));
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "package.json"), JSON.stringify({ name: "youmd-cli" }));

    process.chdir(nested);
    const { detectProjectContext } = await import("../lib/config");
    const detected = detectProjectContext();

    expect(detected?.root ? fs.realpathSync.native(detected.root) : null).toBe(fs.realpathSync.native(nested));
    expect(detected?.name).toBe("youmd-cli");
    expect(detected?.marker).toBe("package.json");
  });

  it("falls back to the git repo root when cwd has no marker of its own", async () => {
    const repo = path.join(tmpDir, "youmd");
    const nested = path.join(repo, "src", "lib");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "youmd" }));
    fs.mkdirSync(nested, { recursive: true });

    process.chdir(nested);
    const { detectProjectContext } = await import("../lib/config");
    const detected = detectProjectContext();

    expect(detected?.root ? fs.realpathSync.native(detected.root) : null).toBe(fs.realpathSync.native(repo));
    expect(detected?.name).toBe("youmd");
    expect(detected?.marker).toBe(".git");
  });
});
