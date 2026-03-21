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

# Local deploy
PROD_KEY="${CONVEX_PROD_DEPLOY_KEY:-prod:kindly-cassowary-600|eyJ2MiI6ImY0NWYyN2I3NGFkMjRiYjBiNDkxYTNiNWU0NzdmM2VlIn0=}"
DEV_KEY="${CONVEX_DEV_DEPLOY_KEY:-dev:uncommon-chicken-142|eyJ2MiI6ImUxMjI0MzkzMGM2ODQ4ZWM5NzE2YjIwNzlhZWM1NmMzIn0=}"

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

export CONVEX_DEPLOY_KEY="$DEPLOY_KEY"

echo ">> Running: npx convex deploy"
npx convex deploy

echo ">> Done."
