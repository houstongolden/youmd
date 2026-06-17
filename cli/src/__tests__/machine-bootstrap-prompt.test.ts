import { describe, expect, it } from "vitest";
import * as os from "os";
import {
  buildFreshMachineBootstrapCommand,
  buildFreshMachineBootstrapPrompt,
} from "../lib/machine-bootstrap-prompt";

describe("fresh machine bootstrap prompt", () => {
  it("builds one pasteable shell command with portfolio graph hydration and project clone steps", () => {
    const command = buildFreshMachineBootstrapCommand({
      apiKey: "ym_test'quoted",
      root: "~/Desktop/CODE_2026",
      days: 120,
      limit: 44,
      maxCloneProjects: 3,
      envVaultPath: "~/Desktop/env-local-backup.tar.gz.gpg",
      requireEnvVault: true,
    });

    expect(command).toContain("YOUMD_API_KEY='ym_test'\"'\"'quoted'");
    expect(command).toContain("YOUMD_CODE_ROOT='~/Desktop/CODE_2026'");
    expect(command).toContain("YOUMD_ACTIVE_DAYS='120'");
    expect(command).toContain("YOUMD_PROJECT_LIMIT='44'");
    expect(command).toContain("YOUMD_MAX_CLONE_PROJECTS='3'");
    expect(command).toContain("YOUMD_ENV_VAULT='~/Desktop/env-local-backup.tar.gz.gpg'");
    expect(command).toContain("YOUMD_REQUIRE_ENV_VAULT='1'");
    expect(command).toContain("bash -lc");
    expect(command).toContain("curl -fsSL https://you.md/install.sh | bash");
    expect(command).toContain('HYDRATE_TIMEOUT="${YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS:-180}"');
    expect(command).toContain('run_with_timeout "$HYDRATE_TIMEOUT" youmd project portfolio-hydrate');
    expect(command).toContain('youmd login --key "$YOUMD_API_KEY"');
    expect(command).toContain('youmd project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT"');
    expect(command).toContain('DAYS="${YOUMD_ACTIVE_DAYS:-30}"');
    expect(command).toContain('EXPAND_DAYS="${YOUMD_EXPAND_ACTIVE_DAYS:-90}"');
    expect(command).toContain("RECENT_ONLY_ARGS=()");
    expect(command).toContain('if youmd machine --help 2>/dev/null | grep -q -- "--recent-only"; then');
    expect(command).toContain("RECENT_ONLY_ARGS=(--recent-only)");
    expect(command).toContain("run_machine_projects_recent_only()");
    expect(command).toContain('youmd machine projects "$@" </dev/null');
    expect(command).toContain('PROJECT_ARGS=(--root "$ROOT" --days "$DAYS" "${RECENT_ONLY_ARGS[@]}")');
    expect(command).toContain('PROJECT_ARGS+=(--max-clone-projects "$YOUMD_MAX_CLONE_PROJECTS")');
    expect(command).toContain('run_machine_projects_recent_only "${PROJECT_ARGS[@]}" --dry-run');
    expect(command).toContain('run_machine_projects_recent_only "${PROJECT_ARGS[@]}"');
    expect(command).toContain('expand to all active projects from the last ${EXPAND_DAYS} days');
    expect(command).toContain("ACTIVE + Top Priority/Focusing");
    expect(command).toContain('EXPAND_PROJECT_ARGS=(--root "$ROOT" --days "$EXPAND_DAYS" "${RECENT_ONLY_ARGS[@]}")');
    expect(command).toContain('YOUMD_EXPAND_TO_90_DAYS');
    expect(command).toContain("FULL_PROJECT_SET_COMPLETE=0");
    expect(command).toContain('fresh-machine full ${EXPAND_DAYS}-day project setup complete');
    expect(command).toContain('fresh-machine ${DAYS}-day setup pass complete');
    expect(command).toContain('youmd env backup --root "$ROOT" --preflight');
    expect(command).toContain('DEFAULT_ENV_VAULT_DIR="$HOME/Desktop/youmd-env-vault"');
    expect(command).toContain('find "$DEFAULT_ENV_VAULT_DIR"');
    expect(command).toContain('export YOUMD_ENV_VAULT="$DETECTED_ENV_VAULT"');
    expect(command).toContain('using detected env vault');
    expect(command).toContain('if [ ! -f "$YOUMD_ENV_VAULT" ]; then');
    expect(command).toContain('YOUMD_ENV_VAULT_KEYCHAIN_SERVICE:-youmd-env-vault');
    expect(command).toContain('security find-generic-password');
    expect(command).toContain('export ENV_VAULT_PASS="$ENV_VAULT_PASS_FROM_KEYCHAIN"');
    expect(command).toContain("no env-vault Keychain item found; restore will prompt for the passphrase");
    expect(command).toContain('youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT" --list');
    expect(command).toContain('youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT"');
    expect(command).toContain("youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(command).toContain("YOUMD_ENV_VAULT=/path/to/env-vault-YYYYMMDDTHHMMZ.tar.enc YOUMD_REQUIRE_ENV_VAULT=1 <same command>");
    expect(command).toContain('strict proof requires YOUMD_ENV_VAULT');
    expect(command).toContain('[ "${YOUMD_REQUIRE_ENV_VAULT:-}" = "1" ]');
    expect(command).toContain('youmd machine verify --root "$ROOT" --max-projects "$LIMIT" --write-report --sync-report');
    expect(command).toContain('YOUMD_RUN_CHECKS');
    expect(command).toContain('--run-checks --max-check-projects "${YOUMD_MAX_CHECK_PROJECTS:-8}"');
    expect(command).toContain('YOUMD_INSTALL_DEPS');
    expect(command).toContain('--install-deps --max-install-projects "${YOUMD_MAX_INSTALL_PROJECTS:-4}"');
    expect(command).toContain('YOUMD_PROBE_SERVERS');
    expect(command).toContain('--probe-servers --max-server-projects "${YOUMD_MAX_SERVER_PROJECTS:-3}"');
    expect(command).toContain("--write-report");
    expect(command).toContain("--sync-report");
    expect(command).not.toContain(".env.local=");
  });

  it("renders a copyable agent prompt with secret-safe env-vault language", () => {
    const prompt = buildFreshMachineBootstrapPrompt({ root: "~/Desktop/CODE_YOU" });

    expect(prompt).toContain("Fresh computer bootstrap for Claude Code / Codex");
    expect(prompt).toContain("```bash");
    expect(prompt).toContain("previews the graph-backed project setup plan");
    expect(prompt).toContain("clones projects that are both ACTIVE and Top Priority/Focusing from the last 30 days first");
    expect(prompt).toContain("asks before expanding the workspace to all active focused projects from the last 90 days");
    expect(prompt).toContain("audits cloned project readiness without reading secret values");
    expect(prompt).toContain("writes a secret-safe machine proof report");
    expect(prompt).toContain("syncs the proof summary back to your You.md machine dashboard");
    expect(prompt).toContain("checks env-vault tooling");
    expect(prompt).toContain("auto-detects the newest encrypted vault in `~/Desktop/youmd-env-vault/`");
    expect(prompt).toContain("The command auto-detects the newest vault there");
    expect(prompt).toContain("lists an encrypted env vault without writing files");
    expect(prompt).toContain("tries macOS Keychain service `youmd-env-vault` for the passphrase");
    expect(prompt).toContain("If macOS Keychain contains service `youmd-env-vault` for the current user, restore uses it automatically");
    expect(prompt).toContain("YOUMD_MAX_CLONE_PROJECTS");
    expect(prompt).toContain("YOUMD_RUN_CHECKS=1");
    expect(prompt).toContain("YOUMD_INSTALL_DEPS=1");
    expect(prompt).toContain("YOUMD_PROBE_SERVERS=1");
    expect(prompt).toContain("YOUMD_REQUIRE_ENV_VAULT=1");
    expect(prompt).toContain("YOUMD_EXPAND_TO_90_DAYS=1");
    expect(prompt).toContain("You.md portfolio graph + authenticated GitHub recent repos");
    expect(prompt).toContain("clones only projects with status ACTIVE and focus Top Priority/Focusing");
    expect(prompt).toContain("inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped");
    expect(prompt).toContain("First pass is 30 days");
    expect(prompt).toContain(".env.local values are never embedded here");
    expect(prompt).toContain("youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(prompt).toContain("YOUMD_ENV_VAULT=/path/to/env-vault-*.tar.enc");
    expect(prompt).toContain("variable names/counts and target paths only");
    expect(prompt).toContain("fails instead of pretending setup is complete");
  });

  it("keeps home-relative root and vault paths portable for a different Mac", () => {
    const command = buildFreshMachineBootstrapCommand({
      root: `${os.homedir()}/Desktop/CODE_YOU`,
      envVaultPath: `${os.homedir()}/Desktop/env-local-backup.tar.gz.gpg`,
    });
    const prompt = buildFreshMachineBootstrapPrompt({
      root: `${os.homedir()}/Desktop/CODE_YOU`,
      envVaultPath: `${os.homedir()}/Desktop/env-local-backup.tar.gz.gpg`,
    });

    expect(command).toContain("YOUMD_CODE_ROOT='~/Desktop/CODE_YOU'");
    expect(command).toContain("YOUMD_ENV_VAULT='~/Desktop/env-local-backup.tar.gz.gpg'");
    expect(command).not.toContain(`YOUMD_CODE_ROOT='${os.homedir()}`);
    expect(command).not.toContain(`YOUMD_ENV_VAULT='${os.homedir()}`);
    expect(prompt).toContain("creates ~/Desktop/CODE_YOU");
    expect(prompt).not.toContain(`creates ${os.homedir()}/Desktop/CODE_YOU`);
  });
});
