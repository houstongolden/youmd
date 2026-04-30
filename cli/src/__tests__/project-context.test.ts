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

  it("prefers the git repo root over a nested package.json", async () => {
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

    expect(detected?.root ? fs.realpathSync.native(detected.root) : null).toBe(fs.realpathSync.native(repo));
    expect(detected?.name).toBe("youmd");
    expect(detected?.marker).toBe(".git");
  });
});
