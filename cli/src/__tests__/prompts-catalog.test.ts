import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("prompts catalog", () => {
  let tmpRoot: string;
  let tmpHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "youmd-prompts-catalog-"))
    );
    tmpHome = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "youmd-prompts-home-"))
    );
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function seedPromptLogs(): { alpha: string; beta: string } {
    const alpha = path.join(tmpRoot, "alpha");
    const beta = path.join(tmpRoot, "beta");
    const ignored = path.join(tmpRoot, "node_modules", "ignored");

    fs.mkdirSync(path.join(alpha, "project-context"), { recursive: true });
    fs.mkdirSync(path.join(beta, "project-context"), { recursive: true });
    fs.mkdirSync(path.join(ignored, "project-context"), { recursive: true });

    fs.writeFileSync(
      path.join(alpha, ".youmd-project"),
      JSON.stringify({ name: "Alpha Project" })
    );
    fs.writeFileSync(
      path.join(alpha, "project-context", "prompts.md"),
      [
        "# Prompt History",
        "",
        "## 2026-06-15 - alpha setup",
        "",
        "### Houston messages, verbatim",
        "",
        "**09:10 PT - First alpha ask**",
        "",
        "> make this durable",
        "",
        "## 2026-06-16 - alpha continuation",
        "",
        "**03:41 PT - Last alpha ask**",
        "",
        "> continue",
        "",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(beta, "project-context", "prompt-history.md"),
      [
        "# Legacy Prompt History",
        "",
        "## 2026-06-14 - beta session",
        "",
        "**21:05 PT - Legacy beta ask**",
        "",
        "> keep this too",
        "",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(ignored, "project-context", "prompts.md"),
      "**00:00 PT - Should not index**\n"
    );

    return { alpha, beta };
  }

  it("discovers canonical and legacy project prompt logs", async () => {
    const { alpha, beta } = seedPromptLogs();
    const {
      buildPromptCatalog,
      findPromptHistoryFiles,
      renderPromptCatalogMarkdown,
    } = await import("../commands/prompts");

    const files = findPromptHistoryFiles([tmpRoot]);
    expect(files).toEqual([
      path.join(alpha, "project-context", "prompts.md"),
      path.join(beta, "project-context", "prompt-history.md"),
    ]);

    const catalog = buildPromptCatalog(files);
    expect(catalog).toHaveLength(2);
    expect(catalog.map((entry) => entry.projectName)).toEqual([
      "Alpha Project",
      "beta",
    ]);
    expect(catalog[0].entryCount).toBe(2);
    expect(catalog[0].lastEntry?.context).toBe("Last alpha ask");
    expect(catalog[1].legacy).toBe(true);

    const markdown = renderPromptCatalogMarkdown(catalog);
    expect(markdown).toContain("Projects indexed: 2");
    expect(markdown).toContain("Prompt entries indexed: 3");
    expect(markdown).toContain("(legacy name)");
    expect(markdown).not.toContain("ignored");
  });

  it("writes the catalog without requiring Claude transcript discovery", async () => {
    seedPromptLogs();
    const outPath = path.join(tmpHome, ".youmd", "private", "prompt-catalog.md");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { promptsCommand } = await import("../commands/prompts");

    await promptsCommand("catalog", "--root", tmpRoot, "--out", outPath);

    expect(logSpy).toHaveBeenCalled();
    expect(fs.existsSync(outPath)).toBe(true);
    const written = fs.readFileSync(outPath, "utf-8");
    expect(written).toContain("# Prompt History Catalog");
    expect(written).toContain("Alpha Project");
    expect(written).toContain("beta");
  });
});
