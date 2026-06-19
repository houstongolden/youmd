import { describe, expect, it } from "vitest";

import { GET } from "../../../src/app/install.sh/route";

describe("install.sh route", () => {
  it("avoids Bash 3.2 empty-array expansion under set -u", async () => {
    const response = await GET();
    const script = await response.text();

    expect(script).toContain('NPM_GLOBAL_PREFIX=""');
    expect(script).toContain("npm_install_global()");
    expect(script).toContain('npm install -g --prefix "$NPM_GLOBAL_PREFIX" "$@"');
    expect(script).toContain("Creating secret-safe local agent stack inventory");
    expect(script).toContain('youmd skill inventory --out-dir "$INVENTORY_DIR"');
    expect(script).toContain('YOUMD_INSTALL_INVENTORY:-1');
    expect(script).not.toContain("NPM_GLOBAL_FLAGS");
    expect(script).not.toContain('"${NPM_GLOBAL_FLAGS[@]}"');
  });
});
