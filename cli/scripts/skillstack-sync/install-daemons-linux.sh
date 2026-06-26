#!/usr/bin/env bash
# install-daemons-linux.sh — install resident You.md sync daemons as systemd --user units
#
# The Linux counterpart to install-daemons.sh (which is macOS/launchd-only). Lets You.md
# run always-on on a headless Linux VPS (Hostinger, etc.) so the box stays subscribed to the
# Convex websocket, picks up cross-machine agent-bus commands, and keeps skills/stacks/context
# in sync with your Macs — exactly like a Mac mini does via launchd.
#
# Design:
#   - you-realtime-sync.service  → long-running `youmd sync --live --daemon` (Restart=always)
#   - you-{skillstack,identity,context}-sync.service+.timer → interval oneshots
#   - loginctl enable-linger so the units run without an active login session (critical on a VPS)
#
# Idempotent: safe to re-run. Does NOT need sudo — runs as the current user via `systemctl --user`.
#
# Usage: ./install-daemons-linux.sh

set -euo pipefail

YOU_HOME="${YOU_HOME:-${YOUMD_HOME:-${HOME}/.you}}"
LOG_DIR="${YOU_HOME}/logs"
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"

# Resolve an absolute path to the You.md binary — systemd --user units do NOT source the
# login profile, so we cannot rely on PATH picking up the npm global bin at runtime.
YOU_BIN="$(command -v youmd || command -v you || true)"
if [ -z "${YOU_BIN}" ]; then
  echo "ERROR: could not find the 'youmd' (or 'you') binary on PATH." >&2
  echo "       Install the runtime first: curl -fsSL https://you.md/install.sh | bash" >&2
  exit 1
fi

if ! systemctl --user --version >/dev/null 2>&1; then
  echo "ERROR: 'systemctl --user' is unavailable on this host." >&2
  echo "       This box has no systemd user instance; cannot install resident daemons here." >&2
  echo "       Fallback: run 'youmd sync --live' under nohup/pm2/tmux, or a cron for interval sync." >&2
  exit 1
fi

# systemd >= 240 is required for StandardOutput=append: (so the health check can read log files).
SYSTEMD_VER="$(systemctl --version 2>/dev/null | head -n1 | awk '{print $2}' | tr -d -c '0-9')"
USE_APPEND=1
if [ -n "${SYSTEMD_VER}" ] && [ "${SYSTEMD_VER}" -lt 240 ] 2>/dev/null; then
  USE_APPEND=0
  echo "WARN: systemd ${SYSTEMD_VER} < 240; logging to the journal only (file-based health may be blank)."
fi

echo "==> You.md binary: ${YOU_BIN}"
echo "==> Log directory: ${LOG_DIR}"
echo "==> Unit directory: ${UNIT_DIR}"
mkdir -p "${LOG_DIR}" "${UNIT_DIR}"

# A sane PATH for the units (npm global locations + system bins); HOME is inherited by --user.
UNIT_PATH="${HOME}/.you/bin:${HOME}/.youmd/npm-global/bin:${HOME}/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"

# Emit StandardOutput/StandardError lines for a unit given a log basename.
log_lines() {
  local base="$1"
  if [ "${USE_APPEND}" = "1" ]; then
    printf 'StandardOutput=append:%s/%s.out.log\nStandardError=append:%s/%s.err.log\n' \
      "${LOG_DIR}" "${base}" "${LOG_DIR}" "${base}"
  else
    printf 'StandardOutput=journal\nStandardError=journal\n'
  fi
}

# write_service <unit-name> <description> <youmd-args> <log-base> <restart?>
write_service() {
  local unit="$1" desc="$2" cmd_args="$3" base="$4" restart="$5"
  local dst="${UNIT_DIR}/${unit}"
  echo "  - writing ${unit}"
  {
    printf '[Unit]\nDescription=%s\nStartLimitIntervalSec=0\n\n[Service]\n' "${desc}"
    if [ "${restart}" = "always" ]; then
      printf 'Type=simple\nRestart=always\nRestartSec=10\n'
    else
      printf 'Type=oneshot\n'
    fi
    printf 'Environment=HOME=%s\n' "${HOME}"
    printf 'Environment=YOU_HOME=%s\n' "${YOU_HOME}"
    printf 'Environment=PATH=%s\n' "${UNIT_PATH}"
    printf 'ExecStart=%s %s\n' "${YOU_BIN}" "${cmd_args}"
    log_lines "${base}"
    if [ "${restart}" = "always" ]; then
      printf '\n[Install]\nWantedBy=default.target\n'
    fi
  } > "${dst}"
}

# write_timer <unit-name> <description> <interval-seconds> <service-unit>
write_timer() {
  local unit="$1" desc="$2" interval="$3" service="$4"
  local dst="${UNIT_DIR}/${unit}"
  echo "  - writing ${unit}"
  cat > "${dst}" <<EOF
[Unit]
Description=${desc}

[Timer]
OnBootSec=30
OnUnitActiveSec=${interval}
Unit=${service}
AccuracySec=15

[Install]
WantedBy=timers.target
EOF
}

echo ""
echo "==> Generating systemd --user units"

# Live realtime brain — long-running websocket sync, restart on crash.
write_service "you-realtime-sync.service" "You.md realtime brain (live websocket sync)" \
  "sync --live --daemon" "realtime-sync" "always"

# Interval daemons (oneshot service + timer).
write_service "you-skillstack-sync.service" "You.md skills/stacks sync" "stack sync" "skillstack-sync" "oneshot"
write_timer   "you-skillstack-sync.timer"   "You.md skills/stacks sync (every 5m)" 300 "you-skillstack-sync.service"

write_service "you-identity-sync.service" "You.md identity/API sync" "sync --daemon" "identity-sync" "oneshot"
write_timer   "you-identity-sync.timer"   "You.md identity/API sync (every 5m)" 300 "you-identity-sync.service"

write_service "you-context-sync.service" "You.md project-context sync" "stack context-sync" "context-sync" "oneshot"
write_timer   "you-context-sync.timer"   "You.md project-context sync (every 15m)" 900 "you-context-sync.service"

echo ""
echo "==> Enabling linger so daemons run without an active login session"
# Best-effort: enable-linger usually needs no sudo for your own user; ignore failure.
loginctl enable-linger "$(id -un)" 2>/dev/null \
  || echo "  (could not enable linger automatically; run: sudo loginctl enable-linger $(id -un))"

echo ""
echo "==> Reloading + starting units"
systemctl --user daemon-reload
systemctl --user enable --now you-realtime-sync.service
systemctl --user enable --now you-skillstack-sync.timer
systemctl --user enable --now you-identity-sync.timer
systemctl --user enable --now you-context-sync.timer

echo ""
echo "================================================================"
echo "Resident You.md daemons installed and running (systemd --user)."
echo ""
echo "Status:"
echo "  systemctl --user status you-realtime-sync.service"
echo "  systemctl --user list-timers 'you-*'"
echo ""
echo "Logs:"
echo "  journalctl --user -u you-realtime-sync.service -f"
echo "  ${LOG_DIR}/realtime-sync.out.log"
echo ""
echo "Uninstall:"
echo "  youmd stack daemon uninstall"
echo "================================================================"
