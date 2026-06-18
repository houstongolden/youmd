#!/usr/bin/env bash
# install-daemons.sh — install resident You.md sync LaunchAgents
#
# Idempotent: safe to re-run. Unloads before reloading.
# Does NOT need sudo — LaunchAgents run as the current user.
#
# Usage: ./install-daemons.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
LOG_DIR="${HOME}/.youmd/logs"

PLISTS="com.youmd.realtime-sync com.youmd.skillstack-sync com.youmd.identity-sync com.youmd.context-sync"

echo "==> Creating log directory: ${LOG_DIR}"
mkdir -p "${LOG_DIR}"

echo "==> Creating LaunchAgents directory: ${LAUNCH_AGENTS_DIR}"
mkdir -p "${LAUNCH_AGENTS_DIR}"

for label in ${PLISTS}; do
  src="${SCRIPT_DIR}/${label}.plist"
  dst="${LAUNCH_AGENTS_DIR}/${label}.plist"

  if [ ! -f "${src}" ]; then
    echo "ERROR: Source plist not found: ${src}" >&2
    exit 1
  fi

  echo ""
  echo "--- Installing ${label} ---"

  # Substitute __HOME__ placeholder with actual home dir
  # BSD sed: use a temp file, no -i '' in-place on stdin
  local_tmp="$(mktemp -t youmd_plist)"
  sed "s|__HOME__|${HOME}|g" "${src}" > "${local_tmp}"

  # Unload existing daemon if loaded (ignore errors — it may not be loaded)
  if launchctl list "${label}" >/dev/null 2>&1; then
    echo "  Unloading existing ${label}..."
    launchctl unload "${dst}" 2>/dev/null || true
  fi

  echo "  Copying ${label}.plist → ${LAUNCH_AGENTS_DIR}/"
  cp "${local_tmp}" "${dst}"
  rm -f "${local_tmp}"

  echo "  Loading ${label}..."
  launchctl load -w "${dst}"

  echo "  Loaded: ${label}"
done

echo ""
echo "================================================================"
echo "Resident You.md daemons installed and running."
echo ""
echo "Log files:"
echo "  ${LOG_DIR}/realtime-sync.out.log   (Convex websocket sync stdout)"
echo "  ${LOG_DIR}/realtime-sync.err.log   (Convex websocket sync stderr)"
echo "  ${LOG_DIR}/skillstack-sync.log      (combined sync log)"
echo "  ${LOG_DIR}/skillstack-sync.out.log  (daemon stdout)"
echo "  ${LOG_DIR}/skillstack-sync.err.log  (daemon stderr)"
echo "  ${LOG_DIR}/identity-sync.out.log    (youmd sync stdout)"
echo "  ${LOG_DIR}/identity-sync.err.log    (youmd sync stderr)"
echo "  ${LOG_DIR}/context-sync.log         (combined project-context sync log)"
echo "  ${LOG_DIR}/context-sync.out.log     (daemon stdout)"
echo "  ${LOG_DIR}/context-sync.err.log     (daemon stderr)"
echo ""
echo "Check daemon status:"
echo "  launchctl list com.youmd.realtime-sync"
echo "  launchctl list com.youmd.skillstack-sync"
echo "  launchctl list com.youmd.identity-sync"
echo "  launchctl list com.youmd.context-sync"
echo ""
echo "To uninstall:"
for label in ${PLISTS}; do
  echo "  launchctl unload ${LAUNCH_AGENTS_DIR}/${label}.plist && rm ${LAUNCH_AGENTS_DIR}/${label}.plist"
done
echo "================================================================"
