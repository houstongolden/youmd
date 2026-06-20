import { describe, expect, it } from "vitest";

import {
  MIRROR_MAX_FILE_BYTES,
  MIRROR_MAX_FILES,
  MIRROR_MAX_TOTAL_BYTES,
  isMirrorablePath,
} from "./repoMirrorPolicy";

describe("repo mirror policy", () => {
  it("mirrors safe identity, stack, project, context, and agent-stack paths", () => {
    expect(isMirrorablePath("you.md")).toBe(true);
    expect(isMirrorablePath("you.json")).toBe(true);
    expect(isMirrorablePath("README.md")).toBe(true);
    expect(isMirrorablePath("stacks/coding/youstack.json")).toBe(true);
    expect(isMirrorablePath("identity/bio.md")).toBe(true);
    expect(isMirrorablePath("projects/youmd/tasks.md")).toBe(true);
    expect(isMirrorablePath("context/runtime.md")).toBe(true);
    expect(isMirrorablePath("agent-stack/README.md")).toBe(true);
    expect(isMirrorablePath("agent-stack/inventory.md")).toBe(true);
    expect(isMirrorablePath("agent-stack/inventory.json")).toBe(true);
  });

  it("keeps private and unrelated paths out of the plaintext server mirror", () => {
    expect(isMirrorablePath("private/notes.md")).toBe(false);
    expect(isMirrorablePath("private/env.json")).toBe(false);
    expect(isMirrorablePath(".github/workflows/ci.yml")).toBe(false);
    expect(isMirrorablePath("node_modules/package/index.js")).toBe(false);
  });

  it("keeps explicit bounded mirror caps", () => {
    expect(MIRROR_MAX_FILES).toBe(100);
    expect(MIRROR_MAX_FILE_BYTES).toBe(128 * 1024);
    expect(MIRROR_MAX_TOTAL_BYTES).toBe(700 * 1024);
  });
});
