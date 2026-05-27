import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildInstallerScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

PACKAGE="youmd@latest"
REPO_URL="\${YOUMD_REPO_URL:-https://github.com/houstongolden/youmd.git}"
INSTALL_CHANNEL="\${YOUMD_INSTALL_CHANNEL:-source}"
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
  echo "Installing current You.md runtime from GitHub..."
  git clone --depth 1 "$REPO_URL" "$TMP_DIR/youmd" >/dev/null
  cd "$TMP_DIR/youmd/cli"
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

curl -fsSL https://you.md/install.sh | YOUMD_INSTALL_CHANNEL="\${YOUMD_INSTALL_CHANNEL:-source}" bash >/tmp/youmd-auto-upgrade.log 2>&1 || {
  if [ "\${1:-}" != "--quiet" ]; then
    cat /tmp/youmd-auto-upgrade.log
  fi
  exit 1
}
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

echo ""
echo "Installed You.md runtime: $(youmd --version)"
echo ""
echo "Next:"
echo "  you                  # meet U; it will guide login, pull, stacks, or setup"
echo "  youmd mcp --install codex --auto"
echo "  youmd stack smoke --path <stack-folder>"
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
