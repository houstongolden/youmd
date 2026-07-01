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
    expect(script).toContain('npm install -g --prefer-online --prefix "$NPM_GLOBAL_PREFIX" "$@"');
    expect(script).toContain("binary_meets_required_version()");
    expect(script).toContain("find_runtime_bin_dir()");
    expect(script).toContain('PREFERRED_BIN_DIR="$(find_runtime_bin_dir 2>/dev/null || true)"');
    expect(script).toContain('[ -n "$PREFERRED_BIN_DIR" ] && [ -x "$PREFERRED_BIN_DIR/$BIN_NAME" ]');
    expect(script).toContain('PATH_WITHOUT_YOUMD=""');
    expect(script).toContain('[ "$BIN_PATH" != "$YOUMD_BIN_DIR/$BIN_NAME" ]');
    expect(script).toContain("hash -r");
    expect(script).toContain("Creating secret-safe local agent stack inventory");
    expect(script).toContain('you skill inventory --out-dir "$INVENTORY_DIR" --register-catalog --sync');
    expect(script).toContain('YOU_INSTALL_INVENTORY:-${YOUMD_INSTALL_INVENTORY:-1}');
    expect(script).toContain('YOU_INSTALL_MIGRATE_HOME:-${YOUMD_INSTALL_MIGRATE_HOME:-1}');
    expect(script).toContain('you machine migrate-home --yes');
    expect(script).toContain('run `you machine migrate-home --yes` after install');
    expect(script).toContain('YOU_INSTALL_MACHINE_SYNC:-${YOUMD_INSTALL_MACHINE_SYNC:-auto}');
    expect(script).toContain('YOU_INSTALL_LOGIN:-${YOUMD_INSTALL_LOGIN:-auto}');
    expect(script).toContain('YOU_BOOTSTRAP_API_KEY="${YOU_API_KEY:-${YOUMD_API_KEY:-}}"');
    expect(script).toContain('you login --key "$YOU_BOOTSTRAP_API_KEY"');
    expect(script).toContain('you login </dev/tty');
    expect(script).toContain('you machine full-sync --recent-only --root "$SYNC_ROOT" --max-projects "$SYNC_LIMIT" --days "$SYNC_DAYS"');
    expect(script).toContain("installs, authenticates when possible, syncs brain/skills/stacks/MCP/proof/daemons");
    expect(script).toContain("YOU_INSTALL_MACHINE_SYNC=0");
    expect(script).not.toContain("NPM_GLOBAL_FLAGS");
    expect(script).not.toContain('"${NPM_GLOBAL_FLAGS[@]}"');
  });
});
