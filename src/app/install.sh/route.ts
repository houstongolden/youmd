import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildInstallerScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

PACKAGE="youmd@latest"

echo ""
echo "you.md installer"
echo "----------------"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required before installing youmd."
  echo ""
  echo "Install Node.js first, then rerun:"
  echo "  curl -fsSL https://you.md/install.sh | bash"
  echo ""
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required before installing youmd."
  echo ""
  echo "Install npm/Node first, then rerun:"
  echo "  curl -fsSL https://you.md/install.sh | bash"
  echo ""
  exit 1
fi

echo "Installing $PACKAGE globally..."
if ! npm install -g "$PACKAGE"; then
  echo ""
  echo "Global npm install failed."
  echo "If your machine blocks global npm writes, use a Node version manager"
  echo "like nvm or volta, then rerun the installer."
  echo ""
  exit 1
fi

if ! command -v youmd >/dev/null 2>&1; then
  echo ""
  echo "youmd installed, but the binary is not on your PATH yet."
  echo "Open a new shell and run:"
  echo "  youmd --version"
  echo ""
  exit 0
fi

echo ""
echo "Installed: $(youmd --version)"
echo ""
echo "Next:"
echo "  youmd login"
echo "  youmd init"
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
