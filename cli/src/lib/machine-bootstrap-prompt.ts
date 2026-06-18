import * as os from "os";

export const DEFAULT_FRESH_MACHINE_ROOT = "~/Desktop/CODE_YOU";
export const DEFAULT_FRESH_MACHINE_DAYS = 30;
export const DEFAULT_FRESH_MACHINE_EXPAND_DAYS = 90;
export const DEFAULT_FRESH_MACHINE_LIMIT = 80;

export interface FreshMachineBootstrapOptions {
  apiKey?: string;
  root?: string;
  days?: string | number;
  limit?: string | number;
  maxCloneProjects?: string | number;
  envVaultPath?: string;
  requireEnvVault?: boolean;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function envAssignment(name: string, value: string | number | undefined): string | null {
  if (value === undefined || value === null || `${value}`.trim() === "") return null;
  return `${name}=${shellQuote(String(value))}`;
}

function portableHomePath(value: string | undefined): string | undefined {
  if (!value) return value;
  const home = os.homedir();
  if (!home || !value.startsWith(home)) return value;
  const suffix = value.slice(home.length);
  if (!suffix) return "~";
  if (suffix.startsWith("/")) return `~${suffix}`;
  return value;
}

export function buildFreshMachineBootstrapScript(): string {
  return [
    "set -euo pipefail",
    'ROOT="${YOUMD_CODE_ROOT:-$HOME/Desktop/CODE_YOU}"',
    'DAYS="${YOUMD_ACTIVE_DAYS:-30}"',
    'EXPAND_DAYS="${YOUMD_EXPAND_ACTIVE_DAYS:-90}"',
    'LIMIT="${YOUMD_PROJECT_LIMIT:-80}"',
    'HYDRATE_TIMEOUT="${YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS:-180}"',
    'run_with_timeout() {',
    '  seconds="$1"',
    "  shift",
    '  if command -v gtimeout >/dev/null 2>&1; then',
    '    gtimeout "$seconds" "$@"',
    '  elif command -v timeout >/dev/null 2>&1; then',
    '    timeout "$seconds" "$@"',
    "  else",
    '    "$@" &',
    "    pid=$!",
    '    ( sleep "$seconds"; if kill -0 "$pid" >/dev/null 2>&1; then echo "[you.md] timeout after ${seconds}s: $*" >&2; kill "$pid" >/dev/null 2>&1 || true; fi ) &',
    "    watcher=$!",
    '    wait "$pid"',
    "    status=$?",
    '    kill "$watcher" >/dev/null 2>&1 || true',
    '    wait "$watcher" 2>/dev/null || true',
    '    return "$status"',
    "  fi",
    "}",
    'echo "[you.md] installing runtime"',
    "curl -fsSL https://you.md/install.sh | bash",
    'if [ -n "${YOUMD_API_KEY:-}" ]; then',
    '  echo "[you.md] logging in with bootstrap key"',
    '  youmd login --key "$YOUMD_API_KEY"',
    "else",
    '  echo "[you.md] no YOUMD_API_KEY set; starting interactive login"',
    "  youmd login",
    "fi",
    'echo "[you.md] pulling identity bundle and syncing local brain"',
    "youmd pull",
    "youmd sync",
    'echo "[you.md] restoring shared skills, stacks, and agent host config"',
    "youmd machine setup",
    "youmd skill install all",
    "youmd skill sync",
    "youmd mcp --install claude --auto || true",
    "youmd mcp --install codex --auto || true",
    "youmd skill link claude || true",
    "youmd skill link codex || true",
    'if command -v gh >/dev/null 2>&1; then',
    "  gh auth status >/dev/null 2>&1 || gh auth login",
    "else",
    '  echo "[you.md] GitHub CLI missing; private repo clones may need gh installed"',
    "fi",
    "RECENT_ONLY_ARGS=()",
    'if youmd machine --help 2>/dev/null | grep -q -- "--recent-only"; then',
    "  RECENT_ONLY_ARGS=(--recent-only)",
    "else",
    '  echo "[you.md] installed CLI does not expose --recent-only yet; using noninteractive no-to-older-projects fallback"',
    "fi",
    "run_machine_projects_recent_only() {",
    '  if [ "${#RECENT_ONLY_ARGS[@]}" -gt 0 ]; then',
    '    youmd machine projects "$@"',
    "  else",
    '    youmd machine projects "$@" </dev/null',
    "  fi",
    "}",
    'echo "[you.md] hydrating portfolio graph from You.md/GitHub before the 30-day local clone pass"',
    'run_with_timeout "$HYDRATE_TIMEOUT" youmd project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT" || true',
    'PROJECT_ARGS=(--root "$ROOT" --days "$DAYS" "${RECENT_ONLY_ARGS[@]}")',
    'if [ -n "${YOUMD_MAX_CLONE_PROJECTS:-}" ]; then',
    '  PROJECT_ARGS+=(--max-clone-projects "$YOUMD_MAX_CLONE_PROJECTS")',
    "fi",
    'echo "[you.md] previewing graph-backed 30-day project setup plan (ACTIVE + Top Priority/Focusing only)"',
    'run_machine_projects_recent_only "${PROJECT_ARGS[@]}" --dry-run || true',
    'echo "[you.md] creating code workspace and cloning ACTIVE + Top Priority/Focusing 30-day project repos"',
    'run_machine_projects_recent_only "${PROJECT_ARGS[@]}"',
    'echo "[you.md] checking encrypted env-vault tooling without printing secrets"',
    'youmd env backup --root "$ROOT" --preflight || true',
    'if [ -z "${YOUMD_ENV_VAULT:-}" ]; then',
    '  DEFAULT_ENV_VAULT_DIR="$HOME/Desktop/youmd-env-vault"',
    '  if [ -d "$DEFAULT_ENV_VAULT_DIR" ]; then',
    '    DETECTED_ENV_VAULT="$(find "$DEFAULT_ENV_VAULT_DIR" -maxdepth 1 -type f \\( -name "env-vault-*.tar.enc" -o -name "env-vault-*.tar.age" -o -name "env-vault-*.tar.gpg" \\) -print 2>/dev/null | sort | tail -n 1 || true)"',
    '    if [ -n "$DETECTED_ENV_VAULT" ]; then',
    '      export YOUMD_ENV_VAULT="$DETECTED_ENV_VAULT"',
    '      echo "[you.md] using detected env vault: $YOUMD_ENV_VAULT"',
    "    fi",
    "  fi",
    "fi",
    'if [ -n "${YOUMD_ENV_VAULT:-}" ]; then',
    '  if [ ! -f "$YOUMD_ENV_VAULT" ]; then',
    '    echo "[you.md] env vault path does not exist: $YOUMD_ENV_VAULT" >&2',
    "    exit 1",
    "  fi",
    '  if [ -z "${ENV_VAULT_PASS:-}" ] && command -v security >/dev/null 2>&1; then',
    '    KEYCHAIN_SERVICE="${YOUMD_ENV_VAULT_KEYCHAIN_SERVICE:-youmd-env-vault}"',
    '    if ENV_VAULT_PASS_FROM_KEYCHAIN="$(security find-generic-password -a "${USER:-${LOGNAME:-houston}}" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null)"; then',
    '      export ENV_VAULT_PASS="$ENV_VAULT_PASS_FROM_KEYCHAIN"',
    '      unset ENV_VAULT_PASS_FROM_KEYCHAIN',
    '      echo "[you.md] loaded env-vault passphrase from macOS Keychain service: $KEYCHAIN_SERVICE"',
    "    else",
    '      echo "[you.md] no env-vault Keychain item found; restore will prompt for the passphrase"',
    "    fi",
    "  fi",
    '  echo "[you.md] listing encrypted .env.local vault before restore"',
    '  youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT" --list',
    '  echo "[you.md] restoring encrypted .env.local vault"',
    '  youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT"',
    "else",
    '  echo "[you.md] env vault not restored yet"',
    '  echo "[you.md] On the old/source Mac, create the encrypted vault first:"',
    '  echo "youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault"',
    '  echo "[you.md] Move the generated env-vault-*.tar.enc file to this Mac, then rerun this command with:"',
    '  echo "YOUMD_ENV_VAULT=/path/to/env-vault-YYYYMMDDTHHMMZ.tar.enc YOUMD_REQUIRE_ENV_VAULT=1 <same command>"',
    '  echo "[you.md] Or restore manually after clone:"',
    '  echo "youmd env restore <vault> --root \\"$ROOT\\""',
    '  if [ "${YOUMD_REQUIRE_ENV_VAULT:-}" = "1" ]; then',
    '    echo "[you.md] strict proof requires YOUMD_ENV_VAULT; stopping before readiness is marked complete" >&2',
    "    exit 1",
    "  fi",
    "fi",
    'echo "[you.md] rehydrating portfolio graph with local README/project-context/env-key evidence"',
    'run_with_timeout "$HYDRATE_TIMEOUT" youmd project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT" || true',
    'echo "[you.md] auditing cloned project readiness"',
    'youmd machine verify --root "$ROOT" --max-projects "$LIMIT" --write-report --sync-report || true',
    "FULL_PROJECT_SET_COMPLETE=0",
    'EXPAND_TO_90="${YOUMD_EXPAND_TO_90_DAYS:-}"',
    'if [ -z "$EXPAND_TO_90" ] && [ "${YOUMD_SKIP_90_DAY_EXPANSION_PROMPT:-}" != "1" ] && [ -t 0 ]; then',
    '  printf "\\n[you.md] expand to all active projects from the last ${EXPAND_DAYS} days before calling setup complete? [y/N] "',
    '  read -r EXPAND_TO_90',
    "fi",
    'case "$EXPAND_TO_90" in',
    '  y|Y|yes|YES|1|true|TRUE)',
    '    echo "[you.md] expanding workspace to active ${EXPAND_DAYS}-day project set"',
    '    run_with_timeout "$HYDRATE_TIMEOUT" youmd project portfolio-hydrate --root "$ROOT" --days "$EXPAND_DAYS" --limit "$LIMIT" || true',
    '    EXPAND_PROJECT_ARGS=(--root "$ROOT" --days "$EXPAND_DAYS" "${RECENT_ONLY_ARGS[@]}")',
    '    if [ -n "${YOUMD_MAX_CLONE_PROJECTS:-}" ]; then',
    '      EXPAND_PROJECT_ARGS+=(--max-clone-projects "$YOUMD_MAX_CLONE_PROJECTS")',
    "    fi",
    '    run_machine_projects_recent_only "${EXPAND_PROJECT_ARGS[@]}" --dry-run || true',
    '    run_machine_projects_recent_only "${EXPAND_PROJECT_ARGS[@]}"',
    '    run_with_timeout "$HYDRATE_TIMEOUT" youmd project portfolio-hydrate --root "$ROOT" --days "$EXPAND_DAYS" --limit "$LIMIT" || true',
    '    youmd machine verify --root "$ROOT" --max-projects "$LIMIT" --write-report --sync-report || true',
    "    FULL_PROJECT_SET_COMPLETE=1",
    '    ;;',
    '  *)',
    '    echo "[you.md] stopped after the ${DAYS}-day active project setup; ${EXPAND_DAYS}-day expansion remains intentionally open."',
    '    ;;',
    "esac",
    'if [ "${YOUMD_RUN_CHECKS:-}" = "1" ]; then',
    '  echo "[you.md] running bounded package checks"',
    '  youmd machine verify --root "$ROOT" --max-projects "$LIMIT" --run-checks --max-check-projects "${YOUMD_MAX_CHECK_PROJECTS:-8}" --check-timeout-ms "${YOUMD_CHECK_TIMEOUT_MS:-120000}" --write-report --sync-report || true',
    "else",
    '  echo "[you.md] bounded package checks skipped; set YOUMD_RUN_CHECKS=1 to run lint/typecheck/test/build caps"',
    "fi",
    'if [ "${YOUMD_INSTALL_DEPS:-}" = "1" ] || [ "${YOUMD_PROBE_SERVERS:-}" = "1" ]; then',
    '  echo "[you.md] running bounded clean-host install/server proof"',
    '  VERIFY_ARGS=(--root "$ROOT" --max-projects "$LIMIT")',
    '  if [ "${YOUMD_INSTALL_DEPS:-}" = "1" ]; then',
    '    VERIFY_ARGS+=(--install-deps --max-install-projects "${YOUMD_MAX_INSTALL_PROJECTS:-4}" --install-timeout-ms "${YOUMD_INSTALL_TIMEOUT_MS:-180000}")',
    "  fi",
    '  if [ "${YOUMD_PROBE_SERVERS:-}" = "1" ]; then',
    '    VERIFY_ARGS+=(--probe-servers --max-server-projects "${YOUMD_MAX_SERVER_PROJECTS:-3}" --server-timeout-ms "${YOUMD_SERVER_TIMEOUT_MS:-45000}" --server-start-port "${YOUMD_SERVER_START_PORT:-4310}")',
    "  fi",
    '  youmd machine verify "${VERIFY_ARGS[@]}" --write-report --sync-report || true',
    "else",
    '  echo "[you.md] clean-host install/server proof skipped; set YOUMD_INSTALL_DEPS=1 and YOUMD_PROBE_SERVERS=1 to install deps and smoke-probe local dev servers"',
    "fi",
    'echo "[you.md] installing resident identity/skillstack/project-context daemons"',
    "youmd stack daemon install || true",
    "youmd stack daemon status || true",
    "youmd status",
    'if [ "$FULL_PROJECT_SET_COMPLETE" = "1" ]; then',
    '  echo "[you.md] fresh-machine full ${EXPAND_DAYS}-day project setup complete: $ROOT"',
    "else",
    '  echo "[you.md] fresh-machine ${DAYS}-day setup pass complete; ${EXPAND_DAYS}-day expansion is still open: $ROOT"',
    "fi",
  ].join("\n");
}

export function buildFreshMachineBootstrapCommand(options: FreshMachineBootstrapOptions = {}): string {
  const assignments = [
    envAssignment("YOUMD_API_KEY", options.apiKey),
    envAssignment("YOUMD_CODE_ROOT", portableHomePath(options.root)),
    envAssignment("YOUMD_ACTIVE_DAYS", options.days ?? DEFAULT_FRESH_MACHINE_DAYS),
    envAssignment("YOUMD_PROJECT_LIMIT", options.limit ?? DEFAULT_FRESH_MACHINE_LIMIT),
    envAssignment("YOUMD_MAX_CLONE_PROJECTS", options.maxCloneProjects),
    envAssignment("YOUMD_ENV_VAULT", portableHomePath(options.envVaultPath)),
    envAssignment("YOUMD_REQUIRE_ENV_VAULT", options.requireEnvVault ? "1" : undefined),
  ].filter((value): value is string => Boolean(value));

  return `${assignments.join(" ")} bash -lc ${shellQuote(buildFreshMachineBootstrapScript())}`;
}

export function buildFreshMachineBootstrapPrompt(options: FreshMachineBootstrapOptions = {}): string {
  const root = portableHomePath(options.root) ?? DEFAULT_FRESH_MACHINE_ROOT;
  const days = options.days ?? DEFAULT_FRESH_MACHINE_DAYS;
  const expandDays = DEFAULT_FRESH_MACHINE_EXPAND_DAYS;
  const limit = options.limit ?? DEFAULT_FRESH_MACHINE_LIMIT;
  const command = buildFreshMachineBootstrapCommand(options);
  const authLine = options.apiKey
    ? "A scoped bootstrap key is embedded in the command. Treat this as secret local setup material."
    : "If no bootstrap key is embedded, the command falls back to interactive You.md login.";

  return [
    "You are Claude Code or Codex running on my brand-new Mac.",
    "",
    "Goal: set up this blank computer so it has my You.md identity context, shared skills/stacks, MCP wiring, agent preferences/prompts, active project repos, encrypted `.env.local` files, machine proof sync, and resident sync behavior from my source Mac.",
    "",
    "Do not just explain this. Execute the setup, stream progress, and verify the result. Run the exact command below in the terminal first.",
    "",
    authLine,
    "",
    "Exact setup command:",
    "",
    "```bash",
    command,
    "```",
    "",
    "What it will do:",
    "- install You.md from the curl runtime",
    "- authenticate and pull/sync your identity bundle",
    "- install/configure MCP for Claude Code and Codex",
    "- restore shared agent skills, stack config, Claude/Codex links, and resident sync daemons",
    "- hydrate the portfolio graph from You.md + authenticated GitHub before cloning",
    `- preview the graph-backed plan, create ${root}, and clone only projects marked ACTIVE plus Top Priority/Focusing from the last ${days} days first`,
    `- ask whether to expand to all ACTIVE plus Top Priority/Focusing projects from the last ${expandDays} days before calling the full project clone set complete`,
    "- check env-vault tooling, auto-detect the newest `~/Desktop/youmd-env-vault/env-vault-*` file if `YOUMD_ENV_VAULT` is not set, list the encrypted vault, try macOS Keychain service `youmd-env-vault` for the passphrase, restore only after the list passes, then rehydrate local project/env evidence",
    "- write and sync a secret-safe machine proof report, with optional bounded install/check/server proof flags",
    "- bound portfolio hydration with `YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS` so large restored roots do not wedge setup",
    "",
    `Project source: You.md portfolio graph + authenticated GitHub recent repos, capped at ${limit} tracked projects before local audit evidence is merged. When the graph exists, new-computer setup clones only projects with status ACTIVE and focus Top Priority/Focusing; inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped unless --include-inactive is explicitly used. First pass is ${days} days with out-of-window projects skipped; the ${expandDays}-day pass is explicit.`,
    "Secret rule: .env.local values are never embedded here. On the old/source Mac, create a vault with `youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault`, move the generated `env-vault-*.tar.enc` file to `~/Desktop/youmd-env-vault/` on the new machine, then run this command. The command auto-detects the newest vault there; you can also override with `YOUMD_ENV_VAULT=/path/to/env-vault-*.tar.enc`. If macOS Keychain contains service `youmd-env-vault` for the current user, restore uses it automatically; otherwise it prompts. The restore path lists variable names/counts and target paths only, never values.",
    "",
    "After the command finishes, report:",
    "- the `youmd status` sync state",
    `- the \`${root}\` project count`,
    "- whether the encrypted env vault restored",
    "- whether Claude/Codex MCP config was installed",
    "- the synced machine proof status",
    "- whether I should expand to the 90-day active project set if I have not answered yet",
    "",
    "Done-ness rule: for real fresh-computer proof, set YOUMD_REQUIRE_ENV_VAULT=1 or pass --require-env-vault so the command fails instead of pretending setup is complete when the encrypted env vault is missing.",
  ].join("\n");
}
