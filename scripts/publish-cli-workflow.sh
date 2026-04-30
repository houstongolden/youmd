#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required for trusted publishing: install/auth gh first." >&2
  exit 1
fi

git fetch origin main >/dev/null

local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse origin/main)"
if [[ "$local_head" != "$remote_head" ]]; then
  cat >&2 <<EOF
Local HEAD is not pushed to origin/main.

local:  $local_head
remote: $remote_head

Push main first, then rerun:
  git push origin main
  npm run publish:cli
EOF
  exit 1
fi

echo "Triggering trusted npm publish workflow for cli/package.json on origin/main..."
gh workflow run publish-cli.yml --ref main "$@"

sleep 5
run_id="$(gh run list --workflow publish-cli.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
if [[ -z "$run_id" || "$run_id" == "null" ]]; then
  echo "Workflow triggered, but could not find the run id. Check GitHub Actions." >&2
  exit 1
fi

gh run watch "$run_id" --exit-status
