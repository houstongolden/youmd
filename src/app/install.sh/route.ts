import { NextResponse } from "next/server";
import cliPackageJson from "../../../cli/package.json";

export const dynamic = "force-dynamic";

function buildInstallerScript() {
  const cliVersion = cliPackageJson.version;
  return `#!/usr/bin/env bash
set -euo pipefail

CLI_VERSION="${cliVersion}"
PACKAGE="youmd@$CLI_VERSION"
REPO_URL="\${YOU_REPO_URL:-\${YOUMD_REPO_URL:-https://github.com/houstongolden/youmd.git}}"
INSTALL_CHANNEL="\${YOU_INSTALL_CHANNEL:-\${YOUMD_INSTALL_CHANNEL:-source}}"
SOURCE_REF="\${YOU_SOURCE_REF:-\${YOUMD_SOURCE_REF:-main}}"
YOU_HOME_DIR="\${YOU_HOME:-\${YOUMD_HOME:-$HOME/.you}}"
YOUMD_HOME_DIR="$YOU_HOME_DIR"
LEGACY_YOUMD_HOME_DIR="$HOME/.youmd"
YOUMD_BIN_DIR="$YOU_HOME_DIR/bin"
YOUMD_NPM_PREFIX="\${YOU_NPM_PREFIX:-\${YOUMD_NPM_PREFIX:-$YOU_HOME_DIR/npm-global}}"
TMP_DIR=""
NPM_GLOBAL_PREFIX=""
USING_USER_NPM_PREFIX=0
export PATH="$YOUMD_BIN_DIR:$YOUMD_NPM_PREFIX/bin:$LEGACY_YOUMD_HOME_DIR/bin:$LEGACY_YOUMD_HOME_DIR/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

prepend_path_once() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

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

can_write_npm_global_root() {
  GLOBAL_ROOT="$(npm root -g 2>/dev/null || true)"
  if [ -z "$GLOBAL_ROOT" ]; then
    return 1
  fi
  mkdir -p "$GLOBAL_ROOT" >/dev/null 2>&1 && [ -w "$GLOBAL_ROOT" ]
}

configure_npm_target() {
  if [ "\${YOUMD_FORCE_USER_NPM_PREFIX:-0}" = "1" ] || ! can_write_npm_global_root; then
    mkdir -p "$YOUMD_NPM_PREFIX/bin" "$YOUMD_BIN_DIR"
    NPM_GLOBAL_PREFIX="$YOUMD_NPM_PREFIX"
    USING_USER_NPM_PREFIX=1
    prepend_path_once "$YOUMD_NPM_PREFIX/bin"
    prepend_path_once "$YOUMD_BIN_DIR"
    echo "Using user-writable npm prefix: $YOUMD_NPM_PREFIX"
  fi
}

npm_install_global() {
  if [ -n "$NPM_GLOBAL_PREFIX" ]; then
    npm install -g --prefix "$NPM_GLOBAL_PREFIX" "$@"
  else
    npm install -g "$@"
  fi
}

link_runtime_bins() {
  mkdir -p "$YOUMD_BIN_DIR"
  for BIN_NAME in youmd you create-youmd; do
    if [ -x "$YOUMD_NPM_PREFIX/bin/$BIN_NAME" ]; then
      BIN_PATH="$YOUMD_NPM_PREFIX/bin/$BIN_NAME"
    else
      BIN_PATH=""
      NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
      NPM_BIN_DIR="\${NPM_PREFIX:+$NPM_PREFIX/bin}"
      if [ -n "$NPM_BIN_DIR" ] && [ -x "$NPM_BIN_DIR/$BIN_NAME" ]; then
        BIN_PATH="$NPM_BIN_DIR/$BIN_NAME"
      else
        OLD_PATH="$PATH"
        PATH_WITHOUT_YOUMD=""
        IFS=:
        for PATH_PART in $OLD_PATH; do
          if [ "$PATH_PART" != "$YOUMD_BIN_DIR" ]; then
            if [ -z "$PATH_WITHOUT_YOUMD" ]; then
              PATH_WITHOUT_YOUMD="$PATH_PART"
            else
              PATH_WITHOUT_YOUMD="$PATH_WITHOUT_YOUMD:$PATH_PART"
            fi
          fi
        done
        unset IFS
        PATH="$PATH_WITHOUT_YOUMD"
        BIN_PATH="$(command -v "$BIN_NAME" 2>/dev/null || true)"
        PATH="$OLD_PATH"
      fi
    fi
    if [ -n "$BIN_PATH" ] && [ "$BIN_PATH" != "$YOUMD_BIN_DIR/$BIN_NAME" ]; then
      ln -sf "$BIN_PATH" "$YOUMD_BIN_DIR/$BIN_NAME"
    fi
  done
  prepend_path_once "$YOUMD_BIN_DIR"
  hash -r 2>/dev/null || true
}

persist_user_path_hint() {
  PATH_LINE='export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"'
  PROFILE_FILES=()

  if [ -n "\${YOUMD_SHELL_PROFILE:-}" ]; then
    PROFILE_FILES=("$YOUMD_SHELL_PROFILE")
  else
    PROFILE_FILES=("$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile")
  fi

  for PROFILE_FILE in "\${PROFILE_FILES[@]}"; do
    mkdir -p "$(dirname "$PROFILE_FILE")"
    touch "$PROFILE_FILE"
    if ! grep -Fq 'You.md runtime path' "$PROFILE_FILE" 2>/dev/null; then
      {
        echo ""
        echo "# You.md runtime path"
        echo "$PATH_LINE"
      } >> "$PROFILE_FILE"
      echo "Added You.md runtime PATH to $PROFILE_FILE"
    fi
  done
}

echo ""
echo "you.md runtime installer"
echo "------------------------"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required before installing the You.md runtime."
  echo ""
  echo "Install Node.js first, then rerun:"
  echo "  curl -fsSL https://you.md/install.sh | bash"
  echo ""
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required before installing the You.md runtime."
  echo ""
  echo "Install npm/Node first, then rerun:"
  echo "  curl -fsSL https://you.md/install.sh | bash"
  echo ""
  exit 1
fi

configure_npm_target

install_from_source() {
  if ! command -v git >/dev/null 2>&1; then
    return 1
  fi

  TMP_DIR="$(mktemp -d)"
  echo "Installing You.md runtime from GitHub ($SOURCE_REF)..."
  GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$SOURCE_REF" "$REPO_URL" "$TMP_DIR/youmd" >/dev/null || return 1
  cd "$TMP_DIR/youmd/cli" || return 1
  npm ci >/dev/null
  npm run build >/dev/null
  TARBALL="$(npm pack --silent)"
  npm_install_global "$TARBALL" >/dev/null
}

install_from_npm() {
  echo "Installing $PACKAGE globally..."
  npm_install_global "$PACKAGE"
}

if [ "$INSTALL_CHANNEL" = "source" ]; then
  if ! install_from_source; then
    echo ""
    echo "Source install was not available, falling back to npm latest."
    install_from_npm
  fi
else
  install_from_npm
fi

link_runtime_bins
persist_user_path_hint

if ! command -v youmd >/dev/null 2>&1; then
  echo ""
  echo "youmd installed, but the binary is not on your PATH yet."
  echo "Open a new shell and run:"
  echo "  youmd --version"
  echo ""
  exit 0
fi

INSTALLED_VERSION="$(youmd --version 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "$INSTALLED_VERSION" ] || ! version_at_least "$INSTALLED_VERSION" "$CLI_VERSION"; then
  echo ""
  echo "Installed You.md runtime is too old: \${INSTALLED_VERSION:-unknown}"
  echo "Required runtime is: $CLI_VERSION or newer"
  echo "The npm package may still be behind. Re-run with the source channel after this commit is on main:"
  echo "  curl -fsSL https://you.md/install.sh | YOUMD_INSTALL_CHANNEL=source YOUMD_SOURCE_REF=main bash"
  echo ""
  exit 1
fi

mkdir -p "$YOUMD_BIN_DIR"

cat > "$YOUMD_BIN_DIR/youmd-auto-upgrade" <<'AUTOUPGRADE'
#!/usr/bin/env bash
set -euo pipefail

if [ "\${YOUMD_AUTO_UPDATE:-1}" = "0" ]; then
  exit 0
fi

YOU_HOME_DIR="\${YOU_HOME:-\${YOUMD_HOME:-$HOME/.you}}"
STAMP_FILE="$YOU_HOME_DIR/runtime-last-upgrade-check"
NOW="$(date +%s)"
LAST="$(cat "$STAMP_FILE" 2>/dev/null || echo 0)"
INTERVAL_SECONDS="\${YOUMD_AUTO_UPDATE_INTERVAL_SECONDS:-43200}"

if [ "\${YOUMD_AUTO_UPDATE_FORCE:-0}" != "1" ] && [ $((NOW - LAST)) -lt "$INTERVAL_SECONDS" ]; then
  exit 0
fi

mkdir -p "$YOU_HOME_DIR"
printf '%s' "$NOW" > "$STAMP_FILE"

if [ "\${1:-}" != "--quiet" ]; then
  echo "Refreshing You.md runtime..."
fi

LOG_FILE="/tmp/youmd-auto-upgrade.log"
PREV_VERSION="$(youmd --version 2>/dev/null | tr -d '[:space:]' || true)"

curl -fsSL https://you.md/install.sh | YOU_INSTALL_CHANNEL="\${YOU_INSTALL_CHANNEL:-\${YOUMD_INSTALL_CHANNEL:-source}}" bash >"$LOG_FILE" 2>&1 || {
  if [ "\${1:-}" != "--quiet" ]; then
    cat "$LOG_FILE"
  fi
  exit 1
}

# Post-upgrade health check: if the new binary is broken, roll back.
if ! youmd --version >/dev/null 2>&1; then
  echo "youmd upgrade failed health check, rolling back to \${PREV_VERSION:-unknown}" >> "$LOG_FILE"
  if [ -n "$PREV_VERSION" ]; then
    npm install -g "youmd@$PREV_VERSION" >>"$LOG_FILE" 2>&1 || true
  fi
  if [ "\${1:-}" != "--quiet" ]; then
    cat "$LOG_FILE"
  fi
  exit 1
fi
AUTOUPGRADE
chmod +x "$YOUMD_BIN_DIR/youmd-auto-upgrade"

cat > "$YOUMD_HOME_DIR/stack-runtime.md" <<'RUNTIME'
# You.md Stack Runtime

Installed by:

    curl -fsSL https://you.md/install.sh | bash

Agent preamble:

    if [ -x "$HOME/.you/bin/youmd-auto-upgrade" ]; then
      "$HOME/.you/bin/youmd-auto-upgrade" --quiet || true
    fi

Use the curl installer as the product surface. The youmd binary is the helper under the hood.
RUNTIME

echo "Installing native You.md skills..."
youmd skill install all >/dev/null 2>&1 || true
youmd skill sync >/dev/null 2>&1 || true

if [ "\${YOUMD_INSTALL_INVENTORY:-1}" = "1" ]; then
  INVENTORY_DIR="\${YOUMD_AGENT_STACK_INVENTORY_DIR:-$YOUMD_HOME_DIR/agent-stack-inventory}"
  mkdir -p "$INVENTORY_DIR"
  echo "Creating secret-safe local agent stack inventory..."
  if youmd skill inventory --out-dir "$INVENTORY_DIR" --register-catalog --sync >/dev/null 2>&1; then
    echo "  - inventory: $INVENTORY_DIR"
  else
    echo "  - inventory skipped; run \`youmd skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync\` after login/sync"
  fi
fi

# Auto-configure MCP for whichever local agents are present, so they know how
# to use you.md out of the box. Each host write is non-fatal and backs up the
# existing config. Skipped hosts can still be wired later with
# \`youmd mcp --install <host> --auto\`.
echo "Configuring MCP for detected agents..."
MCP_CONFIGURED=0
if command -v claude >/dev/null 2>&1 || [ -f "$HOME/.claude.json" ]; then
  if youmd mcp --install claude --auto >/dev/null 2>&1; then echo "  - Claude Code"; MCP_CONFIGURED=1; fi
fi
if [ -d "$HOME/.codex" ] || command -v codex >/dev/null 2>&1; then
  if youmd mcp --install codex --auto >/dev/null 2>&1; then echo "  - Codex"; MCP_CONFIGURED=1; fi
fi
if [ -d "$HOME/.cursor" ]; then
  if youmd mcp --install cursor --auto >/dev/null 2>&1; then echo "  - Cursor"; MCP_CONFIGURED=1; fi
fi
if [ "$MCP_CONFIGURED" = "0" ]; then
  echo "  (no Claude Code / Codex / Cursor detected — run \\\`youmd mcp --install <host> --auto\\\` after installing one)"
fi

if [ "\${YOUMD_INSTALL_MACHINE_SYNC:-0}" = "1" ] || [ -n "\${YOUMD_API_KEY:-}" ]; then
  SYNC_ROOT="\${YOUMD_CODE_ROOT:-$HOME/Desktop/CODE_YOU}"
  SYNC_LIMIT="\${YOUMD_PROJECT_LIMIT:-80}"
  echo "Reconciling this machine with You.md skill mesh..."
  if [ -n "\${YOUMD_API_KEY:-}" ]; then
    youmd login --key "$YOUMD_API_KEY" >/dev/null 2>&1 || true
  fi
  if youmd machine sync-now --root "$SYNC_ROOT" --max-projects "$SYNC_LIMIT"; then
    echo "  - machine sync proof complete"
  else
    echo "  - machine sync needs follow-up; run: youmd machine sync-now --root \\"$SYNC_ROOT\\""
  fi
fi

if [ "\${YOUMD_INSTALL_DAEMON:-0}" = "1" ]; then
  if [ "$(uname -s 2>/dev/null || true)" = "Darwin" ]; then
    echo "Installing resident You.md sync daemon..."
    youmd stack daemon install || true
  else
    echo "Resident daemon auto-install is currently macOS launchd-only; skipping."
  fi
fi

echo ""
echo "Installed You.md runtime: $(youmd --version)"
if [ "$USING_USER_NPM_PREFIX" = "1" ]; then
  echo "Runtime installed without sudo under: $YOUMD_NPM_PREFIX"
fi
echo ""
echo "Next:"
echo "  youmd login          # press Enter to authenticate this machine in the browser"
echo "  youmd machine sync-now --root ~/Desktop/CODE_YOU"
echo "                       # sync your brain, skills, stacks, MCP, inventory, proof, and daemons"
echo "  you                  # meet U; it will guide onboarding, stacks, and next moves"
echo ""
echo "Auto-update helper:"
echo "  ~/.you/bin/youmd-auto-upgrade --quiet"
echo ""
echo "Install with resident sync enabled:"
echo "  curl -fsSL https://you.md/install.sh | YOUMD_INSTALL_DAEMON=1 bash"
echo ""
echo "Install and immediately sync this machine when you already have an API key:"
echo "  curl -fsSL https://you.md/install.sh | YOUMD_API_KEY=... YOUMD_INSTALL_MACHINE_SYNC=1 bash"
echo ""
`;
}

export async function GET() {
  return new NextResponse(buildInstallerScript(), {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      "content-disposition": 'inline; filename="youmd-install.sh"',
    },
  });
}
