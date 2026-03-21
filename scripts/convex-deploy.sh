#!/usr/bin/env bash
set -euo pipefail

# Convex deploy script for youmd
# Usage:
#   ./scripts/convex-deploy.sh prod    # deploy to production
#   ./scripts/convex-deploy.sh dev     # deploy to dev
#   ./scripts/convex-deploy.sh         # defaults to dev
#
# Keys can be set via env vars CONVEX_PROD_DEPLOY_KEY / CONVEX_DEV_DEPLOY_KEY
# or they fall back to the defaults below.

ENV="${1:-dev}"

PROD_KEY="${CONVEX_PROD_DEPLOY_KEY:-prod:kindly-cassowary-600|eyJ2MiI6ImY0NWYyN2I3NGFkMjRiYjBiNDkxYTNiNWU0NzdmM2VlIn0=}"
DEV_KEY="${CONVEX_DEV_DEPLOY_KEY:-dev:uncommon-chicken-142|eyJ2MiI6ImUxMjI0MzkzMGM2ODQ4ZWM5NzE2YjIwNzlhZWM1NmMzIn0=}"

case "$ENV" in
  prod|production)
    echo ">> Deploying to PRODUCTION (kindly-cassowary-600)..."
    DEPLOY_KEY="$PROD_KEY"
    ;;
  dev|development)
    echo ">> Deploying to DEV (uncommon-chicken-142)..."
    DEPLOY_KEY="$DEV_KEY"
    ;;
  *)
    echo "Unknown environment: $ENV"
    echo "Usage: $0 [prod|dev]"
    exit 1
    ;;
esac

export CONVEX_DEPLOY_KEY="$DEPLOY_KEY"

echo ">> Running: npx convex deploy"
npx convex deploy

echo ">> Done."
