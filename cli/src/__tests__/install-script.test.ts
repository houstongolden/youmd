import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: class MockNextResponse {
    constructor(private readonly body: string) {}

    async text() {
      return this.body;
    }
  },
}));

describe("install.sh route", () => {
  it("avoids Bash 3.2 empty-array expansion under set -u", async () => {
    const { GET } = await import("../../../src/app/install.sh/route");
    const response = await GET();
    const script = await response.text();

    expect(script).toContain('NPM_GLOBAL_PREFIX=""');
    expect(script).toContain('YOU_HOME_DIR="${YOU_HOME:-${YOUMD_HOME:-$HOME/.you}}"');
    expect(script).toContain('$LEGACY_YOUMD_HOME_DIR/bin:$LEGACY_YOUMD_HOME_DIR/npm-global/bin');
    expect(script).toContain('PACKAGE="youmd@$CLI_VERSION"');
    expect(script).toContain("npm_install_global()");
    expect(script).toContain('npm install -g --prefix "$NPM_GLOBAL_PREFIX" "$@"');
    expect(script).toContain('PATH_WITHOUT_YOUMD=""');
    expect(script).toContain('[ "$BIN_PATH" != "$YOUMD_BIN_DIR/$BIN_NAME" ]');
    expect(script).toContain("hash -r");
    expect(script).toContain("Creating secret-safe local agent stack inventory");
    expect(script).toContain('youmd skill inventory --out-dir "$INVENTORY_DIR" --register-catalog --sync');
    expect(script).toContain('YOUMD_INSTALL_INVENTORY:-1');
    expect(script).toContain('YOUMD_INSTALL_MACHINE_SYNC:-0');
    expect(script).toContain('youmd login --key "$YOUMD_API_KEY"');
    expect(script).toContain('youmd machine sync-now --root "$SYNC_ROOT" --max-projects "$SYNC_LIMIT"');
    expect(script).toContain("youmd machine sync-now --root ~/Desktop/CODE_YOU");
    expect(script).not.toContain("NPM_GLOBAL_FLAGS");
    expect(script).not.toContain('"${NPM_GLOBAL_FLAGS[@]}"');
  });
});
