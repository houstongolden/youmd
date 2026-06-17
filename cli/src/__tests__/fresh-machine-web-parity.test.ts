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
    expect(source).toContain("ACTIVE + Top Priority/Focusing");
    expect(source).toContain("clone only projects marked ACTIVE plus Top Priority/Focusing");
    expect(source).toContain("inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped by default");
    expect(source).toContain("YOUMD_CODE_ROOT");
    expect(source).toContain("YOUMD_REQUIRE_ENV_VAULT=1");
    expect(source).toContain("youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(source).toContain("YOUMD_ENV_VAULT=/path/to/env-vault-*.tar.enc");
    expect(source).toContain("YOUMD_ENV_VAULT_KEYCHAIN_SERVICE:-youmd-env-vault");
    expect(source).toContain("security find-generic-password");
    expect(source).toContain("try macOS Keychain service `youmd-env-vault` for the passphrase");
    expect(source).toContain("YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS");
    expect(source).toContain("YOUMD_EXPAND_TO_90_DAYS");
  });
});
