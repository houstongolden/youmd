import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { compileBundle, writeBundle } from "../lib/compiler";

describe("compiler", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-test-"));
    // Create minimal bundle structure
    fs.mkdirSync(path.join(tmpDir, "profile"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "preferences"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("compiles an empty bundle without error", () => {
    const result = compileBundle(tmpDir);
    expect(result).toBeDefined();
    expect(result.youJson).toBeDefined();
    expect(result.markdown).toBeDefined();
    expect(result.manifest).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  it("compiles about.md into identity fields", () => {
    fs.writeFileSync(
      path.join(tmpDir, "profile", "about.md"),
      `---
title: About
---
# Houston Golden

**Tagline:** Building the identity protocol

**Location:** Miami, FL

Founded BAMF Media. Building You.md.`
    );

    const result = compileBundle(tmpDir);
    const identity = result.youJson.identity as Record<string, unknown>;
    expect(identity).toBeDefined();
    expect(identity.name).toBe("Houston Golden");
  });

  it("compiles projects.md into projects array", () => {
    fs.writeFileSync(
      path.join(tmpDir, "profile", "projects.md"),
      `---
title: Projects
---
## You.md
- **Role:** Founder
- **Status:** building
- **Description:** Identity context protocol.
- **URL:** https://you.md

## BAMF Media
- **Role:** CEO
- **Status:** active
- **Description:** Growth marketing agency.`
    );

    const result = compileBundle(tmpDir);
    const projects = result.youJson.projects as Array<Record<string, string>>;
    expect(projects).toBeDefined();
    expect(projects.length).toBeGreaterThanOrEqual(2);
    expect(projects[0].name).toBe("You.md");
  });

  it("compiles preferences into agent prefs", () => {
    fs.writeFileSync(
      path.join(tmpDir, "preferences", "agent.md"),
      `---
title: Agent Preferences
---
**Tone:** direct, no fluff
**Formality:** casual-professional
**Avoid:** corporate speak, emoji`
    );

    const result = compileBundle(tmpDir);
    const prefs = result.youJson.preferences as Record<string, unknown>;
    expect(prefs).toBeDefined();
    const agent = prefs.agent as Record<string, unknown>;
    expect(agent.tone).toContain("direct");
  });

  it("writes bundle files to disk", () => {
    const result = compileBundle(tmpDir);
    writeBundle(tmpDir, result);

    expect(fs.existsSync(path.join(tmpDir, "you.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "you.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "manifest.json"))).toBe(true);

    // you.json should be valid JSON
    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, "you.json"), "utf-8"));
    expect(parsed.schema).toBe("you-md/v1");
  });

  it("tracks stats correctly", () => {
    fs.writeFileSync(path.join(tmpDir, "profile", "about.md"), "# Test\nHello");
    fs.writeFileSync(path.join(tmpDir, "profile", "values.md"), "- Integrity\n- Speed");

    const result = compileBundle(tmpDir);
    expect(result.stats.totalSections).toBeGreaterThan(0);
    expect(result.filesRead.length).toBeGreaterThan(0);
  });
});
