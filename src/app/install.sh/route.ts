import { NextResponse } from "next/server";
import cliPackageJson from "../../../cli/package.json";

export const dynamic = "force-dynamic";

function buildInstallerScript() {
  const cliVersion = cliPackageJson.version;
  return `#!/usr/bin/env bash
set -euo pipefail

PACKAGE="youmd@latest"
CLI_VERSION="${cliVersion}"
REPO_URL="\${YOUMD_REPO_URL:-https://github.com/houstongolden/youmd.git}"
INSTALL_CHANNEL="\${YOUMD_INSTALL_CHANNEL:-source}"
SOURCE_REF="\${YOUMD_SOURCE_REF:-main}"
YOUMD_HOME_DIR="\${YOUMD_HOME:-$HOME/.youmd}"
YOUMD_BIN_DIR="$YOUMD_HOME_DIR/bin"
TMP_DIR=""

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

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
  npm install -g . >/dev/null
}

install_from_npm() {
  echo "Installing $PACKAGE globally..."
  npm install -g "$PACKAGE"
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

if ! command -v youmd >/dev/null 2>&1; then
  echo ""
  echo "youmd installed, but the binary is not on your PATH yet."
  echo "Open a new shell and run:"
  echo "  youmd --version"
  echo ""
  exit 0
fi

mkdir -p "$YOUMD_BIN_DIR"

cat > "$YOUMD_BIN_DIR/youmd-auto-upgrade" <<'AUTOUPGRADE'
#!/usr/bin/env bash
set -euo pipefail

if [ "\${YOUMD_AUTO_UPDATE:-1}" = "0" ]; then
  exit 0
fi

STAMP_FILE="$HOME/.youmd/runtime-last-upgrade-check"
NOW="$(date +%s)"
LAST="$(cat "$STAMP_FILE" 2>/dev/null || echo 0)"
INTERVAL_SECONDS="\${YOUMD_AUTO_UPDATE_INTERVAL_SECONDS:-43200}"

if [ "\${YOUMD_AUTO_UPDATE_FORCE:-0}" != "1" ] && [ $((NOW - LAST)) -lt "$INTERVAL_SECONDS" ]; then
  exit 0
fi

mkdir -p "$HOME/.youmd"
printf '%s' "$NOW" > "$STAMP_FILE"

if [ "\${1:-}" != "--quiet" ]; then
  echo "Refreshing You.md runtime..."
fi

LOG_FILE="/tmp/youmd-auto-upgrade.log"
PREV_VERSION="$(youmd --version 2>/dev/null | tr -d '[:space:]' || true)"

curl -fsSL https://you.md/install.sh | YOUMD_INSTALL_CHANNEL="\${YOUMD_INSTALL_CHANNEL:-npm}" bash >"$LOG_FILE" 2>&1 || {
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

    if [ -x "$HOME/.youmd/bin/youmd-auto-upgrade" ]; then
      "$HOME/.youmd/bin/youmd-auto-upgrade" --quiet || true
    fi

Use the curl installer as the product surface. The youmd binary is the helper under the hood.
RUNTIME

echo "Installing native You.md skills..."
youmd skill install all >/dev/null 2>&1 || true

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

echo ""
echo "Installed You.md runtime: $(youmd --version)"
echo ""
echo "Next:"
echo "  youmd login          # press Enter to authenticate this machine in the browser"
echo "  youmd pull           # sync your live brain into ~/.youmd"
echo "  youmd sync           # refresh skills, stacks, prompts, and project context"
echo "  you                  # meet U; it will guide onboarding, stacks, and next moves"
echo ""
echo "Auto-update helper:"
echo "  ~/.youmd/bin/youmd-auto-upgrade --quiet"
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
