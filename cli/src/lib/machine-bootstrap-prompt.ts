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

function envAssignment(
  name: string,
  value: string | number | undefined,
  options: { expandHome?: boolean } = {}
): string | null {
  if (value === undefined || value === null || `${value}`.trim() === "") return null;
  const stringValue = String(value);
  if (options.expandHome) {
    if (stringValue === "~") return `${name}="$HOME"`;
    if (stringValue.startsWith("~/")) {
      return `${name}="$HOME${stringValue.slice(1).replace(/["\\$`]/g, (char) => `\\${char}`)}"`;
    }
    if (stringValue === "$HOME") return `${name}="$HOME"`;
    if (stringValue.startsWith("$HOME/")) {
      return `${name}="$HOME/${stringValue.slice("$HOME/".length).replace(/["\\$`]/g, (char) => `\\${char}`)}"`;
    }
    if (stringValue === "${HOME}") return `${name}="$HOME"`;
    if (stringValue.startsWith("${HOME}/")) {
      return `${name}="$HOME/${stringValue.slice("${HOME}/".length).replace(/["\\$`]/g, (char) => `\\${char}`)}"`;
    }
  }
  return `${name}=${shellQuote(stringValue)}`;
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
  return `set -euo pipefail
export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
ROOT="\${YOU_CODE_ROOT:-\${YOUMD_CODE_ROOT:-$HOME/Desktop/CODE_YOU}}"
DAYS="\${YOU_ACTIVE_DAYS:-\${YOUMD_ACTIVE_DAYS:-30}}"
EXPAND_DAYS="\${YOU_EXPAND_ACTIVE_DAYS:-\${YOUMD_EXPAND_ACTIVE_DAYS:-90}}"
LIMIT="\${YOU_PROJECT_LIMIT:-\${YOUMD_PROJECT_LIMIT:-80}}"
HYDRATE_TIMEOUT="\${YOU_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS:-\${YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS:-180}}"
MIN_YOUMD_VERSION="\${YOU_MIN_VERSION:-\${YOUMD_MIN_VERSION:-0.8.12}}"
mkdir -p "$ROOT"

command_exists() { command -v "$1" >/dev/null 2>&1; }
node_major() { node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo 0; }
version_at_least() {
  local current="\${1#v}"
  local required="\${2#v}"
  local IFS=.
  local current_parts=($current)
  local required_parts=($required)
  local i current_value required_value
  for i in 0 1 2; do
    current_value="\${current_parts[$i]:-0}"
    required_value="\${required_parts[$i]:-0}"
    current_value="\${current_value%%[^0-9]*}"
    required_value="\${required_value%%[^0-9]*}"
    current_value="\${current_value:-0}"
    required_value="\${required_value:-0}"
    if ((10#$current_value > 10#$required_value)); then return 0; fi
    if ((10#$current_value < 10#$required_value)); then return 1; fi
  done
  return 0
}
ensure_youmd_min_version() {
  local installed
  installed="$(you --version 2>/dev/null | tr -d '[:space:]' || true)"
  echo "[you.md] installed version: \${installed:-unknown}"
  if [ -n "$installed" ] && version_at_least "$installed" "$MIN_YOUMD_VERSION"; then
    return 0
  fi
  echo "[you.md] installed you is older than required \${MIN_YOUMD_VERSION}; forcing GitHub source install"
  curl -fsSL https://you.md/install.sh | YOU_INSTALL_CHANNEL=source YOU_SOURCE_REF=main bash
  export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
  installed="$(you --version 2>/dev/null | tr -d '[:space:]' || true)"
  echo "[you.md] installed version after forced source install: \${installed:-unknown}"
  if [ -z "$installed" ] || ! version_at_least "$installed" "$MIN_YOUMD_VERSION"; then
    echo "[you.md] you \${MIN_YOUMD_VERSION}+ is required for Secret Vault, agent bus, agent stack inventory, and fresh-machine restore. npm latest may still be behind; rerun after this commit is deployed or install from GitHub main." >&2
    exit 1
  fi
}
run_with_timeout() {
  seconds="$1"
  shift
  if command_exists gtimeout; then
    gtimeout "$seconds" "$@"
  elif command_exists timeout; then
    timeout "$seconds" "$@"
  else
    "$@" &
    pid=$!
    ( sleep "$seconds"; if kill -0 "$pid" >/dev/null 2>&1; then echo "[you.md] timeout after \${seconds}s: $*" >&2; kill "$pid" >/dev/null 2>&1 || true; fi ) &
    watcher=$!
    wait "$pid"
    status=$?
    kill "$watcher" >/dev/null 2>&1 || true
    wait "$watcher" 2>/dev/null || true
    return "$status"
  fi
}
run_agent_stack_inventory() {
  INVENTORY_DIR="\${YOU_AGENT_STACK_INVENTORY_DIR:-\${YOUMD_AGENT_STACK_INVENTORY_DIR:-$HOME/.you/agent-stack-inventory}}"
  mkdir -p "$INVENTORY_DIR"
  echo "[you.md] running local/global agent stack inventory into $INVENTORY_DIR"
  if you skill inventory --out-dir "$INVENTORY_DIR" --register-catalog --sync; then
    you agent send --channel machine-sync --kind status "fresh machine \$(hostname) generated agent stack inventory at $INVENTORY_DIR" || true
  else
    echo "[you.md] agent stack inventory did not complete; continuing setup so sync can self-heal, then rerun: you skill inventory --out-dir $INVENTORY_DIR --register-catalog --sync"
    you agent send --channel machine-sync --kind status "fresh machine \$(hostname) could not complete agent stack inventory yet; rerun after shared skill sync" || true
  fi
}

bootstrap_prereqs() {
  echo "[you.md] checking local prerequisites: Homebrew, Node 22/npm, git, gh, bun, pnpm"
  if [ "$(uname -s 2>/dev/null || echo unknown)" = "Darwin" ] && ! command_exists brew; then
    echo "[you.md] Homebrew missing; installing it first so the rest of setup can stay boring"
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true
  fi
  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)" || true; fi
  if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)" || true; fi
  export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

  if command_exists brew; then
    MAJOR="$(node_major)"
    if ! command_exists node || [ "$MAJOR" -lt 20 ] || [ "$MAJOR" -ge 23 ]; then
      echo "[you.md] installing Node 22 for modern Next/Convex projects"
      brew install node@22 || brew install node || true
      brew link --overwrite --force node@22 || true
    fi
    command_exists git || brew install git || true
    command_exists gh || brew install gh || true
    command_exists bun || brew install bun || brew install oven-sh/bun/bun || true
  fi

  export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
  command_exists corepack && corepack enable || true
  if command_exists corepack && ! command_exists pnpm; then
    corepack prepare pnpm@latest --activate || true
  fi

  for required in node npm git; do
    if ! command_exists "$required"; then
      echo "[you.md] required tool missing after bootstrap: $required" >&2
      exit 1
    fi
  done
}

ensure_github_auth() {
  if ! command_exists gh; then
    echo "[you.md] GitHub CLI is missing, so private repo clone/setup cannot continue yet." >&2
    return 1
  fi
  if gh auth status >/dev/null 2>&1; then
    echo "[you.md] GitHub auth is ready"
    return 0
  fi
  echo "[you.md] GitHub auth is required before private skill/project repos can clone."
  if [ -t 0 ]; then
    gh auth login -h github.com -p https -s repo || true
  fi
  if gh auth status >/dev/null 2>&1; then
    echo "[you.md] GitHub auth is ready"
    return 0
  fi
  echo "[you.md] GitHub auth still is not complete."
  echo "[you.md] Open a normal Terminal on this Mac and run:"
  echo "  $(command -v gh || echo gh) auth login -h github.com -p https -s repo"
  echo "[you.md] Then rerun this same setup prompt/command."
  return 1
}

bootstrap_prereqs

echo "[you.md] installing runtime from GitHub main"
curl -fsSL https://you.md/install.sh | YOU_INSTALL_CHANNEL=source YOU_SOURCE_REF=main bash
export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command_exists you; then
  echo "[you.md] you was installed but is not on PATH. Try a new Terminal, then rerun this command." >&2
  exit 1
fi
ensure_youmd_min_version
echo "[you.md] proving canonical ~/.you home migration"
you machine migrate-home --yes || true

YOU_BOOTSTRAP_API_KEY="\${YOU_API_KEY:-\${YOUMD_API_KEY:-}}"
if [ -n "$YOU_BOOTSTRAP_API_KEY" ]; then
  echo "[you.md] logging in with bootstrap key"
  you login --key "$YOU_BOOTSTRAP_API_KEY"
else
  echo "[you.md] no YOU_API_KEY set; starting interactive login"
  you login
fi

echo "[you.md] pulling identity bundle and syncing local brain"
you pull
you sync
you agent send --channel machine-sync --kind status "fresh machine \$(hostname) authenticated, pulled identity, and started setup" || true

echo "[you.md] installing resident realtime/identity/skillstack/project-context daemons early"
you stack daemon install || true
you stack daemon status || true
you agent send --channel machine-sync --kind status "fresh machine \$(hostname) installed resident realtime/skillstack daemons" || true

GITHUB_READY=0
if ensure_github_auth; then
  GITHUB_READY=1
elif [ "\${YOU_REQUIRE_GITHUB_AUTH:-\${YOUMD_REQUIRE_GITHUB_AUTH:-1}}" = "1" ]; then
  echo "[you.md] stopping after You.md identity/daemon setup because GitHub auth is required for private repos." >&2
  exit 2
fi

echo "[you.md] restoring shared skills, stacks, and agent host config"
you machine setup || echo "[you.md] machine setup reported a warning; continuing to skills/MCP so the next run can self-heal"
you skill install all || true
you skill sync || true
you mcp --install claude --auto || true
you mcp --install codex --auto || true
you skill link claude || true
you skill link codex || true
run_agent_stack_inventory
you agent send --channel machine-sync --kind status "fresh machine \$(hostname) restored shared skills/stacks and MCP config" || true

if [ "$GITHUB_READY" != "1" ]; then
  echo "[you.md] GitHub auth is still missing; project clone pass skipped. Rerun after gh auth login."
  you agent send --channel machine-sync --kind status "fresh machine \$(hostname) stopped: GitHub auth required before private project clone" || true
  exit 2
fi

RECENT_ONLY_ARGS=()
if you machine --help 2>/dev/null | grep -q -- "--recent-only"; then
  RECENT_ONLY_ARGS=(--recent-only)
else
  echo "[you.md] installed CLI does not expose --recent-only yet; using noninteractive no-to-older-projects fallback"
fi
run_machine_projects_recent_only() {
  if [ "\${#RECENT_ONLY_ARGS[@]}" -gt 0 ]; then
    you machine projects "$@"
  else
    you machine projects "$@" </dev/null
  fi
}

echo "[you.md] hydrating portfolio graph from You.md/GitHub before the 30-day local clone pass"
run_with_timeout "$HYDRATE_TIMEOUT" you project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT" || true
PROJECT_ARGS=(--root "$ROOT" --days "$DAYS" "\${RECENT_ONLY_ARGS[@]}")
MAX_CLONE_PROJECTS="\${YOU_MAX_CLONE_PROJECTS:-\${YOUMD_MAX_CLONE_PROJECTS:-}}"
if [ -n "$MAX_CLONE_PROJECTS" ]; then
  PROJECT_ARGS+=(--max-clone-projects "$MAX_CLONE_PROJECTS")
fi
echo "[you.md] previewing graph-backed 30-day project setup plan (ACTIVE + Top Priority/Focusing only)"
run_machine_projects_recent_only "\${PROJECT_ARGS[@]}" --dry-run || true
echo "[you.md] creating code workspace and cloning ACTIVE + Top Priority/Focusing 30-day project repos"
run_machine_projects_recent_only "\${PROJECT_ARGS[@]}"
you agent send --channel machine-sync --kind status "fresh machine \$(hostname) finished 30-day active/focused project clone pass into $ROOT" || true

echo "[you.md] checking encrypted env-vault tooling without printing secrets"
you env backup --root "$ROOT" --preflight || true
SECRET_VAULT_RESTORED=0
ENV_VAULT_PATH="\${YOU_ENV_VAULT:-\${YOUMD_ENV_VAULT:-}}"
ALLOW_LOCAL_ENV_VAULT_FALLBACK="\${YOU_ALLOW_LOCAL_ENV_VAULT_FALLBACK:-\${YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK:-0}}"
if [ -z "$ENV_VAULT_PATH" ] && [ "\${YOU_SECRET_VAULT_PULL:-\${YOUMD_SECRET_VAULT_PULL:-1}}" = "1" ]; then
  SECRET_VAULT_DIR="\${YOU_SECRET_VAULT_DIR:-\${YOUMD_SECRET_VAULT_DIR:-$HOME/.you/secret-vault}}"
  echo "[you.md] registering this Mac as a trusted Secret Vault device"
  you env vault device-register || true
  echo "[you.md] checking You.md Secret Vault for the latest encrypted env vault and trusted-device envelope"
  if you env vault pull --out "$SECRET_VAULT_DIR" --restore --root "$ROOT" --map-existing --existing-only --skip-agent-auth; then
    SECRET_VAULT_RESTORED=1
    echo "[you.md] restored env vault through trusted-device Secret Vault"
    you agent send --channel machine-sync --kind status "fresh machine \$(hostname) restored encrypted env vault through trusted-device Secret Vault" || true
  else
    echo "[you.md] account-backed Secret Vault restore is waiting for a trusted-device share"
    echo "[you.md] source Mac action: you env vault share"
    echo "[you.md] new Mac retry: you env vault pull --restore --root \\"$ROOT\\" --map-existing --existing-only --skip-agent-auth"
    you agent send --channel machine-sync --kind status "fresh machine \$(hostname) registered Secret Vault device and is waiting for source Mac trusted-device share" || true
  fi
fi
if [ "$SECRET_VAULT_RESTORED" != "1" ] && [ -z "$ENV_VAULT_PATH" ]; then
  if [ "$ALLOW_LOCAL_ENV_VAULT_FALLBACK" = "1" ]; then
    echo "[you.md] opt-in local/iCloud passphrase vault fallback enabled"
    for DEFAULT_ENV_VAULT_DIR in "$HOME/Desktop/youmd-env-vault" "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/youmd-env-vault" "$HOME/Library/Mobile Documents/com~apple~CloudDocs/youmd-env-vault"; do
      if [ -d "$DEFAULT_ENV_VAULT_DIR" ]; then
        DETECTED_ENV_VAULT="$(find "$DEFAULT_ENV_VAULT_DIR" -maxdepth 1 -type f \\( -name "env-vault-*.tar.enc" -o -name "env-vault-*.tar.age" -o -name "env-vault-*.tar.gpg" \\) -print 2>/dev/null | sort | tail -n 1 || true)"
        if [ -n "$DETECTED_ENV_VAULT" ]; then
          ENV_VAULT_PATH="$DETECTED_ENV_VAULT"
          export YOU_ENV_VAULT="$ENV_VAULT_PATH"
          echo "[you.md] using detected env vault: $ENV_VAULT_PATH"
          break
        fi
      fi
    done
  else
    echo "[you.md] local/iCloud passphrase vault fallback disabled by default"
    echo "[you.md] set YOU_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1 or YOU_ENV_VAULT=/path/to/env-vault only if you intentionally want the older passphrase flow"
  fi
fi
if [ "$SECRET_VAULT_RESTORED" = "1" ]; then
  :
elif [ -n "$ENV_VAULT_PATH" ]; then
  echo "[you.md] using explicit/opt-in local encrypted vault fallback"
  if [ ! -f "$ENV_VAULT_PATH" ]; then
    echo "[you.md] env vault path does not exist: $ENV_VAULT_PATH" >&2
    exit 1
  fi
  if [ -z "\${ENV_VAULT_PASS:-}" ] && command_exists security; then
    KEYCHAIN_SERVICE="\${YOU_ENV_VAULT_KEYCHAIN_SERVICE:-\${YOUMD_ENV_VAULT_KEYCHAIN_SERVICE:-you-env-vault}}"
    if ENV_VAULT_PASS_FROM_KEYCHAIN="$(security find-generic-password -a "\${USER:-\${LOGNAME:-houston}}" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null)"; then
      export ENV_VAULT_PASS="$ENV_VAULT_PASS_FROM_KEYCHAIN"
      unset ENV_VAULT_PASS_FROM_KEYCHAIN
      echo "[you.md] loaded env-vault passphrase from macOS Keychain service: $KEYCHAIN_SERVICE"
    else
      echo "[you.md] no env-vault Keychain item found; explicit local fallback may prompt for the passphrase"
    fi
  fi
  echo "[you.md] listing encrypted .env.local vault before restore"
  you env restore "$ENV_VAULT_PATH" --root "$ROOT" --list --map-existing --existing-only --skip-agent-auth
  echo "[you.md] restoring encrypted .env.local vault into existing cloned project dirs"
  you env restore "$ENV_VAULT_PATH" --root "$ROOT" --map-existing --existing-only --skip-agent-auth
  you agent send --channel machine-sync --kind status "fresh machine \$(hostname) restored encrypted env vault into existing project dirs" || true
else
  echo "[you.md] env vault not restored yet"
  echo "[you.md] On the old/source Mac, create the encrypted vault first:"
  echo "you env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault"
  echo "[you.md] Then share local decrypt access to registered trusted Macs:"
  echo "you env vault share"
  echo "[you.md] Then retry on this Mac:"
  echo "you env vault pull --restore --root \\"$ROOT\\" --map-existing --existing-only --skip-agent-auth"
  echo "[you.md] This strict fresh-machine flow intentionally does not ask for a local vault passphrase on the new Mac by default."
  echo "[you.md] Optional fallback: create a transferable local copy without account sync:"
  echo "you env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault"
  echo "[you.md] Local/iCloud auto-detect is opt-in only. Rerun with:"
  echo "YOU_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1 YOU_REQUIRE_ENV_VAULT=1 <same command>"
  echo "[you.md] Move the generated env-vault-*.tar.enc file to this Mac, then rerun this command with:"
  echo "YOU_ENV_VAULT=/path/to/env-vault-YYYYMMDDTHHMMZ.tar.enc YOU_REQUIRE_ENV_VAULT=1 <same command>"
  echo "[you.md] Or restore manually after clone:"
  echo "you env restore <vault> --root \\"$ROOT\\" --map-existing --existing-only --skip-agent-auth"
  if [ "\${YOU_REQUIRE_ENV_VAULT:-\${YOUMD_REQUIRE_ENV_VAULT:-}}" = "1" ]; then
    echo "[you.md] strict proof is waiting for trusted-device Secret Vault share or an explicitly provided local vault; stopping before readiness is marked complete" >&2
    you agent send --channel machine-sync --kind status "fresh machine \$(hostname) stopped: waiting for trusted-device Secret Vault share or explicit local vault fallback" || true
    exit 1
  fi
fi
echo "[you.md] reconciling identity/skills after env-vault and source-Mac updates"
you pull || true
you sync || true
you agent send --channel machine-sync --kind status "fresh machine \$(hostname) reconciled You.md bundle after env-vault handling" || true
echo "[you.md] rehydrating portfolio graph with local README/project-context/env-key evidence"
run_with_timeout "$HYDRATE_TIMEOUT" you project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT" || true
echo "[you.md] auditing cloned project readiness"
you machine verify --root "$ROOT" --max-projects "$LIMIT" --write-report --sync-report || true
you agent send --channel machine-sync --kind status "fresh machine \$(hostname) synced machine readiness proof for $ROOT" || true
FULL_PROJECT_SET_COMPLETE=0
EXPAND_TO_90="\${YOU_EXPAND_TO_90_DAYS:-\${YOUMD_EXPAND_TO_90_DAYS:-}}"
if [ -z "$EXPAND_TO_90" ] && [ "\${YOU_SKIP_90_DAY_EXPANSION_PROMPT:-\${YOUMD_SKIP_90_DAY_EXPANSION_PROMPT:-}}" != "1" ] && [ -t 0 ]; then
  printf "\\n[you.md] expand to all active projects from the last \${EXPAND_DAYS} days before calling setup complete? [y/N] "
  read -r EXPAND_TO_90
fi
case "$EXPAND_TO_90" in
  y|Y|yes|YES|1|true|TRUE)
    echo "[you.md] expanding workspace to active \${EXPAND_DAYS}-day project set"
    run_with_timeout "$HYDRATE_TIMEOUT" you project portfolio-hydrate --root "$ROOT" --days "$EXPAND_DAYS" --limit "$LIMIT" || true
    EXPAND_PROJECT_ARGS=(--root "$ROOT" --days "$EXPAND_DAYS" "\${RECENT_ONLY_ARGS[@]}")
    if [ -n "$MAX_CLONE_PROJECTS" ]; then
      EXPAND_PROJECT_ARGS+=(--max-clone-projects "$MAX_CLONE_PROJECTS")
    fi
    run_machine_projects_recent_only "\${EXPAND_PROJECT_ARGS[@]}" --dry-run || true
    run_machine_projects_recent_only "\${EXPAND_PROJECT_ARGS[@]}"
    run_with_timeout "$HYDRATE_TIMEOUT" you project portfolio-hydrate --root "$ROOT" --days "$EXPAND_DAYS" --limit "$LIMIT" || true
    you machine verify --root "$ROOT" --max-projects "$LIMIT" --write-report --sync-report || true
    you agent send --channel machine-sync --kind status "fresh machine \$(hostname) expanded to active/focused \${EXPAND_DAYS}-day project set and synced proof" || true
    FULL_PROJECT_SET_COMPLETE=1
    ;;
  *)
    echo "[you.md] stopped after the \${DAYS}-day active project setup; \${EXPAND_DAYS}-day expansion remains intentionally open."
    ;;
esac
if [ "\${YOU_RUN_CHECKS:-\${YOUMD_RUN_CHECKS:-}}" = "1" ]; then
  echo "[you.md] running bounded package checks"
  you machine verify --root "$ROOT" --max-projects "$LIMIT" --run-checks --max-check-projects "\${YOU_MAX_CHECK_PROJECTS:-\${YOUMD_MAX_CHECK_PROJECTS:-8}}" --check-timeout-ms "\${YOU_CHECK_TIMEOUT_MS:-\${YOUMD_CHECK_TIMEOUT_MS:-120000}}" --write-report --sync-report || true
else
  echo "[you.md] bounded package checks skipped; set YOU_RUN_CHECKS=1 to run lint/typecheck/test/build caps"
fi
if [ "\${YOU_INSTALL_DEPS:-\${YOUMD_INSTALL_DEPS:-}}" = "1" ] || [ "\${YOU_PROBE_SERVERS:-\${YOUMD_PROBE_SERVERS:-}}" = "1" ]; then
  echo "[you.md] running bounded clean-host install/server proof"
  VERIFY_ARGS=(--root "$ROOT" --max-projects "$LIMIT")
  if [ "\${YOU_INSTALL_DEPS:-\${YOUMD_INSTALL_DEPS:-}}" = "1" ]; then
    VERIFY_ARGS+=(--install-deps --max-install-projects "\${YOU_MAX_INSTALL_PROJECTS:-\${YOUMD_MAX_INSTALL_PROJECTS:-4}}" --install-timeout-ms "\${YOU_INSTALL_TIMEOUT_MS:-\${YOUMD_INSTALL_TIMEOUT_MS:-180000}}")
  fi
  if [ "\${YOU_PROBE_SERVERS:-\${YOUMD_PROBE_SERVERS:-}}" = "1" ]; then
    VERIFY_ARGS+=(--probe-servers --max-server-projects "\${YOU_MAX_SERVER_PROJECTS:-\${YOUMD_MAX_SERVER_PROJECTS:-3}}" --server-timeout-ms "\${YOU_SERVER_TIMEOUT_MS:-\${YOUMD_SERVER_TIMEOUT_MS:-45000}}" --server-start-port "\${YOU_SERVER_START_PORT:-\${YOUMD_SERVER_START_PORT:-4310}}")
  fi
  you machine verify "\${VERIFY_ARGS[@]}" --write-report --sync-report || true
else
  echo "[you.md] clean-host install/server proof skipped; set YOU_INSTALL_DEPS=1 and YOU_PROBE_SERVERS=1 to install deps and smoke-probe local dev servers"
fi
echo "[you.md] confirming resident realtime/identity/skillstack/project-context daemons"
you stack daemon install || true
you stack daemon status || true
run_agent_stack_inventory
echo "[you.md] running final one-command machine sync/proof consolidation"
you machine sync-now --root "$ROOT" --max-projects "$LIMIT" || true
you status
if [ "$FULL_PROJECT_SET_COMPLETE" = "1" ]; then
  echo "[you.md] fresh-machine full \${EXPAND_DAYS}-day project setup complete: $ROOT"
  you agent send --channel machine-sync --kind status "fresh machine \$(hostname) complete: full \${EXPAND_DAYS}-day active/focused setup at $ROOT" || true
else
  echo "[you.md] fresh-machine \${DAYS}-day setup pass complete; \${EXPAND_DAYS}-day expansion is still open: $ROOT"
  you agent send --channel machine-sync --kind status "fresh machine \$(hostname) complete for \${DAYS}-day active/focused pass at $ROOT; \${EXPAND_DAYS}-day expansion still open" || true
fi`;
}

export function buildFreshMachineBootstrapCommand(options: FreshMachineBootstrapOptions = {}): string {
  const assignments = [
    envAssignment("YOU_API_KEY", options.apiKey),
    envAssignment("YOU_CODE_ROOT", portableHomePath(options.root), { expandHome: true }),
    envAssignment("YOU_ACTIVE_DAYS", options.days ?? DEFAULT_FRESH_MACHINE_DAYS),
    envAssignment("YOU_PROJECT_LIMIT", options.limit ?? DEFAULT_FRESH_MACHINE_LIMIT),
    envAssignment("YOU_MAX_CLONE_PROJECTS", options.maxCloneProjects),
    envAssignment("YOU_ENV_VAULT", portableHomePath(options.envVaultPath), { expandHome: true }),
    envAssignment("YOU_REQUIRE_ENV_VAULT", options.requireEnvVault ? "1" : undefined),
  ].filter((value): value is string => Boolean(value));

  const pathPrefix = `PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"`;
  return `${[pathPrefix, ...assignments].join(" ")} bash -lc ${shellQuote(buildFreshMachineBootstrapScript())}`;
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
    "Goal: set up this blank computer so it has my You.md identity context, shared skills/stacks, MCP wiring, agent preferences/prompts, active project repos, encrypted `.env.local` files, local/global agent stack inventory, machine proof sync, and resident sync behavior from my source Mac.",
    "",
    "Do not just explain this. Execute the setup, stream progress, and verify the result. Run the exact command below in the terminal first.",
    "",
    authLine,
    "",
    "Behind-the-scenes operating rule: use the You.md CLI and You Agent yourself before asking Houston to do anything. Run deterministic commands like `you status`, `you whoami`, `you pull`, `you sync`, `you skill install all`, `you skill sync`, `you skill inventory`, `you env vault list`, `you env vault device-register`, `you env vault pull --restore`, `you machine prompt`, `you machine verify`, `you project portfolio-hydrate`, and `you agent status` as needed. Use `you agent send --channel machine-sync --kind status \"...\"` to report setup milestones back to Houston's other trusted Macs over the realtime agent bus. Use `you` / `you chat` only when you need the You Agent to synthesize or route context, then turn its output into concrete shell actions. Interrupt Houston only for true human-gated steps: GitHub browser auth, source-Mac Secret Vault share if the trusted-device envelope has not been created yet, local vault passphrase/Keychain only when `YOU_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1` or `YOU_ENV_VAULT` is explicitly provided, npm OTP, OS permissions, or an explicit choice such as the 90-day expansion.",
    "",
    "Exact setup command:",
    "",
    "```bash",
    command,
    "```",
    "",
    "What it will do:",
    "- check/install the local prerequisites first: Homebrew, Node 22/npm, git, GitHub CLI, bun, and pnpm/corepack",
    "- install You.md from the curl runtime and force the You.md/Homebrew/Node 22 paths into this setup shell",
    "- prove the canonical `~/.you` home migration while preserving legacy `~/.youmd` fallback",
    "- authenticate and pull/sync your identity bundle",
    "- install resident realtime sync daemons early so identity/skill/project-context sync is not deferred until the end",
    "- require GitHub CLI auth before private shared-skill/project repos clone; if browser auth fails inside Claude/Codex, it prints the exact Terminal command to run and stops cleanly",
    "- install/configure MCP for Claude Code and Codex",
    "- restore shared agent skills, stack config, Claude/Codex links, and agent host config",
    "- generate a secret-safe local/global agent stack inventory under `~/.you/agent-stack-inventory` after shared skills are restored and again near final proof",
    "- use the installed You.md CLI behind the scenes for status, skill sync, Secret Vault pull, portfolio graph hydration, machine verification, and You Agent context routing instead of making Houston manually drive those steps",
    "- publish setup milestones through `you agent send` so Houston's source Mac and realtime daemon can see the Mac mini come online without clipboard babysitting",
    "- hydrate the portfolio graph from You.md + authenticated GitHub before cloning",
    `- preview the graph-backed plan, create ${root}, and clone only projects marked ACTIVE plus Top Priority/Focusing from the last ${days} days first`,
    `- ask whether to expand to all ACTIVE plus Top Priority/Focusing projects from the last ${expandDays} days before calling the full project clone set complete`,
    "- check env-vault tooling, register this Mac as a trusted Secret Vault device, pull the latest account-backed You.md Secret Vault encrypted snapshot when available, unwrap the vault passphrase locally through a trusted-device key envelope, restore env files into existing cloned project dirs with `--map-existing --existing-only --skip-agent-auth`, or stop with the exact source-Mac `you env vault share` action instead of asking for a passphrase on the new Mac. Local/iCloud passphrase fallback runs only when `YOU_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1` or `YOU_ENV_VAULT` is explicitly provided. After env handling, rehydrate local project/env evidence.",
    "- reconcile `you pull && you sync` after env-vault handling so source-Mac bundle updates, new trusted-device envelopes, shared skills, and machine proof state do not leave this Mac showing `remote ahead`",
    "- write and sync a secret-safe machine proof report, with optional bounded install/check/server proof flags",
    "- bound portfolio hydration with `YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS` so large restored roots do not wedge setup",
    "",
    `Project source: You.md portfolio graph + authenticated GitHub recent repos, capped at ${limit} tracked projects before local audit evidence is merged. When the graph exists, new-computer setup clones only projects with status ACTIVE and focus Top Priority/Focusing; inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped unless --include-inactive is explicitly used. First pass is ${days} days with out-of-window projects skipped; the ${expandDays}-day pass is explicit.`,
    "Secret rule: .env.local values are never embedded here. Best path: on the old/source Mac, run `you env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault` once, then after the new Mac registers itself run `you env vault share` on the source Mac. That uploads only encrypted archive bytes plus safe manifest metadata, and stores only per-device encrypted passphrase envelopes. A trusted new Mac pulls the encrypted snapshot after login and decrypts locally with its private device key; raw env values never hit the browser, chat, or You.md servers. If the envelope is missing, the command stops and sends a machine-sync status telling the source Mac to run `you env vault share`. Local fallback is opt-in only: run `you env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault`, move the generated `env-vault-*.tar.enc` file to the new machine, then rerun with `YOU_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1` or explicit `YOU_ENV_VAULT=/path/to/env-vault-*.tar.enc`. The restore path lists variable names/counts and target paths only, never values, maps old folder names onto cloned dirs, and skips agent auth config so it does not clobber the new machine's active Claude/Codex login.",
    "",
    "After the command finishes, report:",
    "- the `you status` sync state",
    `- the \`${root}\` project count`,
    "- whether the encrypted env vault restored",
    "- whether Claude/Codex MCP config was installed",
    "- where the agent stack inventory JSON/HTML was written",
    "- the synced machine proof status",
    "- whether I should expand to the 90-day active project set if I have not answered yet",
    "",
    "Done-ness rule: for real fresh-computer proof, set YOU_REQUIRE_ENV_VAULT=1 or pass --require-env-vault so the command fails instead of pretending setup is complete when the encrypted env vault is missing.",
  ].join("\n");
}
