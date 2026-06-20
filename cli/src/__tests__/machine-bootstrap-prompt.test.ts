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
    expect(command).toContain('YOUMD_CODE_ROOT="$HOME/Desktop/CODE_2026"');
    expect(command).toContain("YOUMD_ACTIVE_DAYS='120'");
    expect(command).toContain("YOUMD_PROJECT_LIMIT='44'");
    expect(command).toContain("YOUMD_MAX_CLONE_PROJECTS='3'");
    expect(command).toContain('YOUMD_ENV_VAULT="$HOME/Desktop/env-local-backup.tar.gz.gpg"');
    expect(command).toContain("YOUMD_REQUIRE_ENV_VAULT='1'");
    expect(command).toContain("bash -lc");
    expect(command).toContain('PATH="$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin');
    expect(command).toContain("bootstrap_prereqs");
    expect(command).toContain("checking local prerequisites: Homebrew, Node 22/npm, git, gh, bun, pnpm");
    expect(command).toContain("brew install node@22");
    expect(command).toContain("brew install gh");
    expect(command).toContain("brew install bun");
    expect(command).toContain("YOUMD_INSTALL_CHANNEL=source YOUMD_SOURCE_REF=main bash");
    expect(command).toContain('MIN_YOUMD_VERSION="${YOUMD_MIN_VERSION:-0.8.11}"');
    expect(command).toContain("ensure_youmd_min_version");
    expect(command).toContain("youmd ${MIN_YOUMD_VERSION}+ is required for Secret Vault, agent bus, agent stack inventory, and fresh-machine restore");
    expect(command).toContain("run_agent_stack_inventory()");
    expect(command).toContain('INVENTORY_DIR="${YOUMD_AGENT_STACK_INVENTORY_DIR:-$HOME/.youmd/agent-stack-inventory}"');
    expect(command).toContain('youmd skill inventory --out-dir "$INVENTORY_DIR" --sync');
    expect(command).toContain("generated agent stack inventory");
    expect(command).toContain('HYDRATE_TIMEOUT="${YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS:-180}"');
    expect(command).toContain('run_with_timeout "$HYDRATE_TIMEOUT" youmd project portfolio-hydrate');
    expect(command).toContain('youmd login --key "$YOUMD_API_KEY"');
    expect(command).toContain("youmd mcp --install claude --auto || true");
    expect(command).toContain("youmd mcp --install codex --auto || true");
    expect(command).toContain("run_agent_stack_inventory");
    expect(command).toContain("ensure_github_auth");
    expect(command).toContain("gh auth login -h github.com -p https -s repo");
    expect(command).toContain("stopping after You.md identity/daemon setup because GitHub auth is required for private repos");
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
    expect(command).toContain('checking You.md Secret Vault for the latest encrypted env vault');
    expect(command).toContain('youmd env vault device-register');
    expect(command).toContain('checking You.md Secret Vault for the latest encrypted env vault and trusted-device envelope');
    expect(command).toContain('youmd env vault pull --out "$SECRET_VAULT_DIR" --restore --root "$ROOT" --map-existing --existing-only --skip-agent-auth');
    expect(command).toContain("restored env vault through trusted-device Secret Vault");
    expect(command).toContain('ALLOW_LOCAL_ENV_VAULT_FALLBACK="${YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK:-0}"');
    expect(command).toContain("account-backed Secret Vault restore is waiting for a trusted-device share");
    expect(command).toContain("source Mac action: youmd env vault share");
    expect(command).toContain("registered Secret Vault device and is waiting for source Mac trusted-device share");
    expect(command).toContain("local/iCloud passphrase vault fallback disabled by default");
    expect(command).toContain("YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1 or YOUMD_ENV_VAULT=/path/to/env-vault");
    expect(command).toContain('if [ "$ALLOW_LOCAL_ENV_VAULT_FALLBACK" = "1" ]; then');
    expect(command).toContain('for DEFAULT_ENV_VAULT_DIR in "$HOME/Desktop/youmd-env-vault"');
    expect(command).toContain('com~apple~CloudDocs/Desktop/youmd-env-vault');
    expect(command).toContain('find "$DEFAULT_ENV_VAULT_DIR"');
    expect(command).toContain('export YOUMD_ENV_VAULT="$DETECTED_ENV_VAULT"');
    expect(command).toContain('using detected env vault');
    expect(command).toContain("using explicit/opt-in local encrypted vault fallback");
    expect(command).toContain('if [ ! -f "$YOUMD_ENV_VAULT" ]; then');
    expect(command).toContain('YOUMD_ENV_VAULT_KEYCHAIN_SERVICE:-youmd-env-vault');
    expect(command).toContain('security find-generic-password');
    expect(command).toContain('export ENV_VAULT_PASS="$ENV_VAULT_PASS_FROM_KEYCHAIN"');
    expect(command).toContain("no env-vault Keychain item found; explicit local fallback may prompt for the passphrase");
    expect(command).toContain('youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT" --list --map-existing --existing-only --skip-agent-auth');
    expect(command).toContain('youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT" --map-existing --existing-only --skip-agent-auth');
    expect(command).toContain("reconciling identity/skills after env-vault and source-Mac updates");
    expect(command).toContain("fresh machine $(hostname) reconciled You.md bundle after env-vault handling");
    expect(command).toContain("youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(command).toContain("youmd env vault share");
    expect(command).toContain("youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(command).toContain("This strict fresh-machine flow intentionally does not ask for a local vault passphrase on the new Mac by default");
    expect(command).toContain("YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1 YOUMD_REQUIRE_ENV_VAULT=1 <same command>");
    expect(command).toContain("YOUMD_ENV_VAULT=/path/to/env-vault-YYYYMMDDTHHMMZ.tar.enc YOUMD_REQUIRE_ENV_VAULT=1 <same command>");
    expect(command).toContain('strict proof is waiting for trusted-device Secret Vault share or an explicitly provided local vault');
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

    expect(prompt).toContain("You are Claude Code or Codex running on my brand-new Mac.");
    expect(prompt).toContain("Do not just explain this. Execute the setup");
    expect(prompt).toContain("Behind-the-scenes operating rule");
    expect(prompt).toContain("use the You.md CLI and You Agent yourself before asking Houston");
    expect(prompt).toContain("youmd skill inventory");
    expect(prompt).toContain("youmd env vault pull");
    expect(prompt).toContain("youmd env vault device-register");
    expect(prompt).toContain("Interrupt Houston only for true human-gated steps");
    expect(prompt).toContain("Exact setup command:");
    expect(prompt).toContain("```bash");
    expect(prompt).toContain("install/configure MCP for Claude Code and Codex");
    expect(prompt).toContain("local/global agent stack inventory");
    expect(prompt).toContain("~/.youmd/agent-stack-inventory");
    expect(prompt).toContain("check/install the local prerequisites first");
    expect(prompt).toContain("installing runtime from GitHub main");
    expect(prompt).toContain("require GitHub CLI auth before private shared-skill/project repos clone");
    expect(prompt).toContain("youmd mcp --install claude --auto");
    expect(prompt).toContain("youmd mcp --install codex --auto");
    expect(prompt).toContain("use the installed You.md CLI behind the scenes for status, skill sync, Secret Vault pull, portfolio graph hydration, machine verification, and You Agent context routing");
    expect(prompt).toContain("preview the graph-backed plan");
    expect(prompt).toContain("clone only projects marked ACTIVE plus Top Priority/Focusing from the last 30 days first");
    expect(prompt).toContain("ask whether to expand to all ACTIVE plus Top Priority/Focusing projects from the last 90 days");
    expect(prompt).toContain("local project/env evidence");
    expect(prompt).toContain("sync a secret-safe machine proof report");
    expect(prompt).toContain("check env-vault tooling");
    expect(prompt).toContain("register this Mac as a trusted Secret Vault device");
    expect(prompt).toContain("account-backed You.md Secret Vault encrypted snapshot");
    expect(prompt).toContain("trusted-device key envelope");
    expect(prompt).toContain("stop with the exact source-Mac `youmd env vault share` action");
    expect(prompt).toContain("Local/iCloud passphrase fallback runs only when `YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1`");
    expect(prompt).toContain("reconcile `youmd pull && youmd sync` after env-vault handling");
    expect(prompt).toContain("do not leave this Mac showing `remote ahead`");
    expect(prompt).toContain("local vault passphrase/Keychain only when `YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1`");
    expect(prompt).toContain("after the new Mac registers itself run `youmd env vault share`");
    expect(prompt).toContain("per-device encrypted passphrase envelopes");
    expect(prompt).toContain("YOUMD_MAX_CLONE_PROJECTS");
    expect(prompt).toContain("YOUMD_REQUIRE_ENV_VAULT=1");
    expect(prompt).toContain("You.md portfolio graph + authenticated GitHub recent repos");
    expect(prompt).toContain("clones only projects with status ACTIVE and focus Top Priority/Focusing");
    expect(prompt).toContain("inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped");
    expect(prompt).toContain("First pass is 30 days");
    expect(prompt).toContain(".env.local values are never embedded here");
    expect(prompt).toContain("youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(prompt).toContain("youmd env vault share");
    expect(prompt).toContain("youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault");
    expect(prompt).toContain("If the envelope is missing, the command stops and sends a machine-sync status");
    expect(prompt).toContain("Local fallback is opt-in only");
    expect(prompt).toContain("YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1");
    expect(prompt).toContain("YOUMD_ENV_VAULT=/path/to/env-vault-*.tar.enc");
    expect(prompt).toContain("variable names/counts and target paths only");
    expect(prompt).toContain("maps old folder names onto cloned dirs");
    expect(prompt).toContain("skips agent auth config");
    expect(prompt).toContain("After the command finishes, report:");
    expect(prompt).toContain("whether Claude/Codex MCP config was installed");
    expect(prompt).toContain("where the agent stack inventory JSON/HTML was written");
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

    expect(command).toContain('YOUMD_CODE_ROOT="$HOME/Desktop/CODE_YOU"');
    expect(command).toContain('YOUMD_ENV_VAULT="$HOME/Desktop/env-local-backup.tar.gz.gpg"');
    expect(command).not.toContain(`YOUMD_CODE_ROOT='${os.homedir()}`);
    expect(command).not.toContain(`YOUMD_ENV_VAULT='${os.homedir()}`);
    expect(command).not.toContain("YOUMD_CODE_ROOT='~/");
    expect(command).not.toContain("YOUMD_ENV_VAULT='~/");
    expect(prompt).toContain("create ~/Desktop/CODE_YOU");
    expect(prompt).not.toContain(`creates ${os.homedir()}/Desktop/CODE_YOU`);
  });
});
