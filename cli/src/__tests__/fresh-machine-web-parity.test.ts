import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const webHookPath = path.join(repoRoot, "src", "hooks", "useYouAgent.ts");

describe("web /new computer bootstrap prompt parity", () => {
  it("keeps the shell prompt aligned with the strict machine setup gate", () => {
    const source = fs.readFileSync(webHookPath, "utf-8");

    expect(source).toContain("read:private");
    expect(source).toContain("write:bundle");
    expect(source).toContain("write:memories");
    expect(source).toContain('"vault"');
    expect(source).toContain("ACTIVE + Top Priority/Focusing");
    expect(source).toContain("clone only projects marked ACTIVE plus Top Priority/Focusing");
    expect(source).toContain("inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped by default");
    expect(source).toContain("YOUMD_CODE_ROOT");
    expect(source).toContain("YOUMD_REQUIRE_ENV_VAULT=1");
    expect(source).toContain("checking local prerequisites: Homebrew, Node 22/npm, git, gh, bun, pnpm");
    expect(source).toContain("YOUMD_INSTALL_CHANNEL=source YOUMD_SOURCE_REF=main bash");
    expect(source).toContain('MIN_YOUMD_VERSION="\\${YOUMD_MIN_VERSION:-0.8.6}"');
    expect(source).toContain("ensure_youmd_min_version");
    expect(source).toContain("youmd \\${MIN_YOUMD_VERSION}+ is required for Secret Vault, agent bus, and fresh-machine restore");
    expect(source).toContain("require GitHub CLI auth before private shared-skill/project repos clone");
    expect(source).toContain("Behind-the-scenes operating rule");
    expect(source).toContain("use the You.md CLI and You Agent yourself before asking Houston");
    expect(source).toContain("use the installed You.md CLI behind the scenes for status, skill sync, Secret Vault pull, portfolio graph hydration, machine verification, and You Agent context routing");
    expect(source).toContain("gh auth login -h github.com -p https -s repo");
    expect(source).toContain("checking You.md Secret Vault for the latest encrypted env vault");
    expect(source).toContain("youmd env vault device-register");
    expect(source).toContain("checking You.md Secret Vault for the latest encrypted env vault and trusted-device envelope");
    expect(source).toContain('youmd env vault pull --out "$SECRET_VAULT_DIR" --restore --root "$ROOT" --map-existing --existing-only --skip-agent-auth');
    expect(source).toContain("restored env vault through trusted-device Secret Vault");
    expect(source).toContain("run this on the source Mac: youmd env vault share");
    expect(source).toContain("youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(source).toContain("youmd env vault share");
    expect(source).toContain("youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(source).toContain("YOUMD_ENV_VAULT=/path/to/env-vault-*.tar.enc");
    expect(source).toContain('for DEFAULT_ENV_VAULT_DIR in "$HOME/Desktop/youmd-env-vault"');
    expect(source).toContain("com~apple~CloudDocs/Desktop/youmd-env-vault");
    expect(source).toContain('export YOUMD_ENV_VAULT="$DETECTED_ENV_VAULT"');
    expect(source).toContain("auto-detect the newest local Desktop or iCloud Desktop");
    expect(source).toContain("--map-existing --existing-only --skip-agent-auth");
    expect(source).toContain("YOUMD_ENV_VAULT_KEYCHAIN_SERVICE:-youmd-env-vault");
    expect(source).toContain("security find-generic-password");
    expect(source).toContain("trusted-device key envelope");
    expect(source).toContain("per-device encrypted passphrase envelopes");
    expect(source).toContain("YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS");
    expect(source).toContain("YOUMD_EXPAND_TO_90_DAYS");
    expect(source).toContain('PATH="$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin');
    expect(source).toContain('shellHomeAssignment("YOUMD_CODE_ROOT", FRESH_MACHINE_BOOTSTRAP_ROOT)');
  });
});
