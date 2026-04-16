import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { compileBundle } from "../lib/compiler";
import { decompileToFilesystem } from "../lib/decompile";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-decompile-"));
  tempDirs.push(dir);
  return dir;
}

describe("decompileToFilesystem", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not scaffold empty/default-only sections from nested bundles", () => {
    const bundleDir = makeTempDir();

    decompileToFilesystem(bundleDir, {
      schema: "you-md/v1",
      username: "tester",
      identity: {
        name: "Test User",
        bio: {
          short: "Short bio.",
          medium: "Short bio.",
          long: "Short bio.",
        },
      },
      now: {
        focus: [],
      },
      preferences: {
        writing: {
          style: "",
          format: "markdown preferred",
        },
      },
      projects: [],
      values: [],
      links: {},
      voice: {},
      agent_directives: {},
    });

    expect(fs.existsSync(path.join(bundleDir, "profile", "about.md"))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, "profile", "now.md"))).toBe(false);
    expect(fs.existsSync(path.join(bundleDir, "preferences", "writing.md"))).toBe(false);
    expect(fs.existsSync(path.join(bundleDir, "profile", "projects.md"))).toBe(false);
    expect(fs.existsSync(path.join(bundleDir, "profile", "values.md"))).toBe(false);
    expect(fs.existsSync(path.join(bundleDir, "profile", "links.md"))).toBe(false);
  });

  it("does not synthesize writing defaults when no writing section exists", () => {
    const bundleDir = makeTempDir();
    for (const dir of ["profile", "preferences", "voice", "directives"]) {
      fs.mkdirSync(path.join(bundleDir, dir), { recursive: true });
    }

    fs.writeFileSync(
      path.join(bundleDir, "profile", "about.md"),
      '---\ntitle: "About"\n---\n\n# Test User\n\nA real bio.\n'
    );

    const compiled = compileBundle(bundleDir);
    const writing = ((compiled.youJson.preferences as Record<string, unknown>)?.writing ??
      {}) as Record<string, unknown>;

    expect(writing.style).toBe("");
    expect(writing.format).toBe("");
  });
});
