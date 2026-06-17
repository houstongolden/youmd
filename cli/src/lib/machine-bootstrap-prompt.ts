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
    'if [ -n "${YOUMD_ENV_VAULT:-}" ]; then',
    '  if [ ! -f "$YOUMD_ENV_VAULT" ]; then',
    '    echo "[you.md] env vault path does not exist: $YOUMD_ENV_VAULT" >&2',
    "    exit 1",
    "  fi",
    '  echo "[you.md] listing encrypted .env.local vault before restore"',
    '  youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT" --list',
    '  echo "[you.md] restoring encrypted .env.local vault"',
    '  youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT"',
    "else",
    '  echo "[you.md] env vault not restored yet"',
    '  echo "copy your encrypted env vault to this machine, then run:"',
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

  return [
    "Fresh computer bootstrap for Claude Code / Codex:",
    "",
    "Copy this whole command into the new machine terminal:",
    "",
    "```bash",
    command,
    "```",
    "",
    `What it does: installs You.md, authenticates, pulls/syncs identity, restores shared agent skills/stacks, fetches and hydrates the persisted portfolio graph, previews the graph-backed project setup plan, creates ${root}, clones projects that are both ACTIVE and Top Priority/Focusing from the last ${days} days first, asks before expanding the workspace to all active focused projects from the last ${expandDays} days, checks env-vault tooling, lists an encrypted env vault without writing files if supplied, restores that vault only after the list step passes, rehydrates local evidence, audits cloned project readiness without reading secret values, writes a secret-safe machine proof report, syncs the proof summary back to your You.md machine dashboard, bounds portfolio hydration with YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS, optionally requires env-vault restore before completion with YOUMD_REQUIRE_ENV_VAULT=1, optionally caps clone count for proof runs with YOUMD_MAX_CLONE_PROJECTS, optionally auto-expands to the ${expandDays}-day set with YOUMD_EXPAND_TO_90_DAYS=1, optionally runs bounded package checks with YOUMD_RUN_CHECKS=1, optionally runs clean-host dependency installs with YOUMD_INSTALL_DEPS=1, optionally smoke-probes local dev servers with YOUMD_PROBE_SERVERS=1, and starts resident sync daemons.`,
    "",
    `Project source: You.md portfolio graph + authenticated GitHub recent repos, capped at ${limit} tracked projects before local audit evidence is merged. When the graph exists, new-computer setup clones only projects with status ACTIVE and focus Top Priority/Focusing; inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped unless --include-inactive is explicitly used. First pass is ${days} days with out-of-window projects skipped; the ${expandDays}-day pass is explicit.`,
    "Secret rule: .env.local values are never embedded here. Use YOUMD_ENV_VAULT or run the printed env restore command with your encrypted vault on the new machine. The restore path lists variable names/counts and target paths only, never values.",
    "Done-ness rule: for real fresh-computer proof, set YOUMD_REQUIRE_ENV_VAULT=1 or pass --require-env-vault so the command fails instead of pretending setup is complete when the encrypted env vault is missing.",
  ].join("\n");
}
