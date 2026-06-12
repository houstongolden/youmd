/**
 * P12 — single project-context engine (PRODUCT-AUDIT #14 / ROADMAP 3.8).
 *
 * A project's context = repo project-context/ OVERLAID on the global
 * .youmd/projects/<slug>/ store: readers see the union, repo wins on file
 * conflicts, and writers route to the repo copy when inside the repo,
 * otherwise to the global store.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  readContextFile,
  readMergedProjectContext,
  resolveProjectContext,
  writeContextFile,
  writeProjectUpdate,
} from "../lib/projectContext";
import { readProjectContext as readManagedProjectContext } from "../lib/project";

describe("project-context engine (P12)", () => {
  let tmpDir: string;
  let repoDir: string;
  let managedDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-pc-engine-"));

    // Repo side: <tmp>/myproj/project-context/
    repoDir = path.join(tmpDir, "myproj");
    fs.mkdirSync(path.join(repoDir, "project-context"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "project-context", "TODO.md"), "# repo todo\n- [ ] ship\n");
    fs.writeFileSync(path.join(repoDir, "project-context", "PRD.md"), "# repo prd\n");

    // Global overlay side: walk-up managed store <tmp>/.youmd/projects/myproj/
    managedDir = path.join(tmpDir, ".youmd", "projects", "myproj");
    fs.mkdirSync(path.join(managedDir, "context"), { recursive: true });
    fs.mkdirSync(path.join(managedDir, "agent"), { recursive: true });
    fs.writeFileSync(
      path.join(managedDir, "project.json"),
      JSON.stringify({
        name: "myproj",
        description: "fixture project",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }) + "\n",
    );
    fs.writeFileSync(path.join(managedDir, "context", "todo.md"), "# global todo\n");
    fs.writeFileSync(path.join(managedDir, "context", "decisions.md"), "# global decisions\n");
    fs.writeFileSync(path.join(managedDir, "agent", "instructions.md"), "managed instructions\n");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("overlay union: readers see repo and global files together", () => {
    const resolved = resolveProjectContext({ cwd: repoDir });

    expect(resolved.repoContextDir).toBe(path.join(repoDir, "project-context"));
    expect(resolved.globalDir).toBe(managedDir);

    const keys = resolved.entries.map((entry) => entry.key).sort();
    expect(keys).toEqual(["decisions.md", "prd.md", "todo.md"]);

    const decisions = resolved.entries.find((entry) => entry.key === "decisions.md");
    expect(decisions?.source).toBe("global");
    const prd = resolved.entries.find((entry) => entry.key === "prd.md");
    expect(prd?.source).toBe("repo");
  });

  it("repo wins on file conflicts and records the shadowed copy", () => {
    const resolved = resolveProjectContext({ cwd: repoDir });

    const todo = resolved.entries.find((entry) => entry.key === "todo.md");
    expect(todo?.source).toBe("repo");
    expect(todo?.shadows).toBe(path.join(managedDir, "context", "todo.md"));

    // Case-insensitive read returns the repo copy
    expect(readContextFile(resolved, "todo")?.content).toContain("# repo todo");
    expect(readContextFile(resolved, "TODO.md")?.source).toBe("repo");
    // Global-only files still resolve through the union
    expect(readContextFile(resolved, "decisions.md")?.source).toBe("global");
    expect(readContextFile(resolved, "decisions.md")?.content).toContain("# global decisions");
  });

  it("write routing: inside the repo writes the repo copy (preserving casing)", () => {
    const resolved = resolveProjectContext({ cwd: repoDir });

    const written = writeContextFile(resolved, "todo.md", "# updated\n");
    expect(written.source).toBe("repo");
    expect(written.path).toBe(path.join(repoDir, "project-context", "TODO.md"));
    expect(fs.readFileSync(written.path, "utf-8")).toBe("# updated\n");

    const fresh = writeContextFile(resolved, "NOTES.md", "new file\n");
    expect(fresh.source).toBe("repo");
    expect(fs.existsSync(path.join(repoDir, "project-context", "NOTES.md"))).toBe(true);
  });

  it("write routing: outside the repo writes the global store", () => {
    const elsewhere = path.join(tmpDir, "elsewhere");
    fs.mkdirSync(elsewhere, { recursive: true });

    const resolved = resolveProjectContext({ cwd: elsewhere, projectName: "myproj" });
    expect(resolved.repoRoot).toBeNull();

    const written = writeContextFile(resolved, "todo.md", "# global update\n");
    expect(written.source).toBe("global");
    expect(written.path).toBe(path.join(managedDir, "context", "todo.md"));
    expect(fs.readFileSync(written.path, "utf-8")).toBe("# global update\n");
  });

  it("writeProjectUpdate routes context/ files to the repo, agent/ files to the global store", () => {
    const resolved = resolveProjectContext({ cwd: repoDir });

    const contextWrite = writeProjectUpdate(resolved, "context/todo.md", "# via update\n");
    expect(contextWrite.source).toBe("repo");
    expect(fs.readFileSync(path.join(repoDir, "project-context", "TODO.md"), "utf-8")).toBe("# via update\n");

    const agentWrite = writeProjectUpdate(resolved, "agent/instructions.md", "sharper\n");
    expect(agentWrite.source).toBe("global");
    expect(fs.readFileSync(path.join(managedDir, "agent", "instructions.md"), "utf-8")).toBe("sharper\n");
  });

  it("merged context keeps the managed reader's shape with repo files winning", () => {
    const merged = readMergedProjectContext({ cwd: repoDir });
    expect(merged).not.toBeNull();

    // Same shape consumers (project show, MCP get_project_context) read before
    const managedOnly = readManagedProjectContext(managedDir);
    expect(Object.keys(merged!).sort()).toEqual(Object.keys(managedOnly!).sort());

    expect(merged!.meta.name).toBe("myproj");
    expect(merged!.todo).toContain("# repo todo"); // repo wins
    expect(merged!.prd).toContain("# repo prd"); // repo-only file surfaces
    expect(merged!.decisions).toContain("# global decisions"); // global-only file stays visible in the union
    expect(merged!.instructions).toContain("managed instructions");
    expect(Array.isArray(merged!.memories)).toBe(true);
  });

  it("repo-only projects still resolve a merged context (union without a managed store)", () => {
    const soloRepo = path.join(tmpDir, "solo");
    fs.mkdirSync(path.join(soloRepo, "project-context"), { recursive: true });
    fs.writeFileSync(path.join(soloRepo, "project-context", "TODO.md"), "- [ ] solo task\n");
    // No .youmd/projects entry for "solo" — make the walk-up store miss it
    const merged = readMergedProjectContext({ cwd: soloRepo });
    expect(merged).not.toBeNull();
    expect(merged!.meta.name).toBe("solo");
    expect(merged!.todo).toContain("solo task");
  });
});
