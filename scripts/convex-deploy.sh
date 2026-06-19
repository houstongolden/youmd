#!/usr/bin/env bash
set -euo pipefail

# Convex deploy script for youmd
# Usage:
#   ./scripts/convex-deploy.sh prod         # deploy to production (local)
#   ./scripts/convex-deploy.sh dev          # deploy to dev (local)
#   ./scripts/convex-deploy.sh              # defaults to dev
#   ./scripts/convex-deploy.sh --remote dev # trigger via GitHub Actions
#
# Keys can be set via env vars CONVEX_PROD_DEPLOY_KEY / CONVEX_DEV_DEPLOY_KEY
# or they fall back to the defaults below.

REMOTE=false
if [[ "${1:-}" == "--remote" ]]; then
  REMOTE=true
  shift
fi

ENV="${1:-dev}"

case "$ENV" in
  prod|production) ENV="prod" ;;
  dev|development) ENV="dev" ;;
  *)
    echo "Unknown environment: $ENV"
    echo "Usage: $0 [--remote] [prod|dev]"
    exit 1
    ;;
esac

if $REMOTE; then
  echo ">> Triggering GitHub Actions deploy to $ENV..."
  gh workflow run convex-deploy.yml -f environment="$ENV"
  echo ">> Workflow dispatched. Waiting for run to start..."
  sleep 3

  # Get the latest run ID for this workflow
  RUN_ID=$(gh run list --workflow=convex-deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')
  echo ">> Run ID: $RUN_ID"
  echo ">> Watching run..."
  gh run watch "$RUN_ID" --exit-status
  exit $?
fi

read_dotenv_key() {
  local key="$1"
  local file="${2:-.env.local}"
  [[ -f "$file" ]] || return 0
  node - "$key" "$file" <<'NODE'
const fs = require("fs");
const [key, file] = process.argv.slice(2);
const text = fs.readFileSync(file, "utf8");
for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const name = trimmed.slice(0, eq).trim();
  if (name !== key) continue;
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.stdout.write(value);
  break;
}
NODE
}

# Local deploy. Prefer explicit environment variables, then fall back to the
# existing .env.local names without sourcing the file. .env.local contains
# values that are not valid shell assignments, so `source .env.local` is unsafe.
PROD_KEY="${CONVEX_PROD_DEPLOY_KEY:-${CONVEX_DEPLOY_KEY:-}}"
DEV_KEY="${CONVEX_DEV_DEPLOY_KEY:-${CONVEX_DEPLOY_KEY_DEV:-}}"

if [[ -z "$PROD_KEY" ]]; then
  PROD_KEY="$(read_dotenv_key CONVEX_PROD_DEPLOY_KEY)"
fi
if [[ -z "$PROD_KEY" ]]; then
  PROD_KEY="$(read_dotenv_key CONVEX_DEPLOY_KEY)"
fi
if [[ -z "$DEV_KEY" ]]; then
  DEV_KEY="$(read_dotenv_key CONVEX_DEV_DEPLOY_KEY)"
fi
if [[ -z "$DEV_KEY" ]]; then
  DEV_KEY="$(read_dotenv_key CONVEX_DEPLOY_KEY_DEV)"
fi

case "$ENV" in
  prod)
    echo ">> Deploying to PRODUCTION (kindly-cassowary-600)..."
    DEPLOY_KEY="$PROD_KEY"
    ;;
  dev)
    echo ">> Deploying to DEV (uncommon-chicken-142)..."
    DEPLOY_KEY="$DEV_KEY"
    ;;
esac

if [[ -z "$DEPLOY_KEY" ]]; then
  echo "ERROR: Deploy key not set for $ENV environment."
  echo "Export CONVEX_PROD_DEPLOY_KEY or CONVEX_DEV_DEPLOY_KEY and try again."
  exit 1
fi

export CONVEX_DEPLOY_KEY="$DEPLOY_KEY"

echo ">> Running: npx convex deploy --yes"
npx convex deploy --yes

echo ">> Done."
