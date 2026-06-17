export const DEFAULT_FRESH_MACHINE_ROOT = "~/Desktop/CODE_YOU";
export const DEFAULT_FRESH_MACHINE_DAYS = 90;
export const DEFAULT_FRESH_MACHINE_LIMIT = 80;

export interface FreshMachineBootstrapOptions {
  apiKey?: string;
  root?: string;
  days?: string | number;
  limit?: string | number;
  envVaultPath?: string;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function envAssignment(name: string, value: string | number | undefined): string | null {
  if (value === undefined || value === null || `${value}`.trim() === "") return null;
  return `${name}=${shellQuote(String(value))}`;
}

export function buildFreshMachineBootstrapScript(): string {
  return [
    "set -euo pipefail",
    'ROOT="${YOUMD_CODE_ROOT:-$HOME/Desktop/CODE_YOU}"',
    'DAYS="${YOUMD_ACTIVE_DAYS:-90}"',
    'LIMIT="${YOUMD_PROJECT_LIMIT:-80}"',
    'echo "[you.md] installing runtime"',
    "curl -fsSL https://you.md/install.sh | bash",
    'if [ -n "${YOUMD_API_KEY:-}" ]; then',
    '  echo "[you.md] logging in with bootstrap key"',
    '  youmd login --key "$YOUMD_API_KEY"',
    "else",
    '  echo "[you.md] no YOUMD_API_KEY set; starting interactive login"',
    "  youmd login",
    "fi",
    'echo "[you.md] pulling identity bundle and syncing local brain"',
    "youmd pull",
    "youmd sync",
    'echo "[you.md] restoring shared skills, stacks, and agent host config"',
    "youmd machine setup",
    "youmd skill install all",
    "youmd skill sync",
    "youmd skill link claude || true",
    "youmd skill link codex || true",
    'if command -v gh >/dev/null 2>&1; then',
    "  gh auth status >/dev/null 2>&1 || gh auth login",
    "else",
    '  echo "[you.md] GitHub CLI missing; private repo clones may need gh installed"',
    "fi",
    'echo "[you.md] hydrating portfolio graph from You.md/GitHub before local clone"',
    'youmd project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT" || true',
    'echo "[you.md] previewing graph-backed project setup plan"',
    'youmd machine projects --root "$ROOT" --days "$DAYS" --dry-run || true',
    'echo "[you.md] creating code workspace and cloning active project repos"',
    'youmd machine projects --root "$ROOT" --days "$DAYS" --yes',
    'if [ -n "${YOUMD_ENV_VAULT:-}" ]; then',
    '  echo "[you.md] restoring encrypted .env.local vault"',
    '  youmd env restore "$YOUMD_ENV_VAULT" --root "$ROOT"',
    "else",
    '  echo "[you.md] env vault not restored yet"',
    '  echo "copy your encrypted env vault to this machine, then run:"',
    '  echo "youmd env restore <vault> --root \\"$ROOT\\""',
    "fi",
    'echo "[you.md] rehydrating portfolio graph with local README/project-context/env-key evidence"',
    'youmd project portfolio-hydrate --root "$ROOT" --days "$DAYS" --limit "$LIMIT" || true',
    'echo "[you.md] auditing cloned project readiness"',
    'youmd machine verify --root "$ROOT" --max-projects "$LIMIT" || true',
    'echo "[you.md] installing resident identity/skillstack/project-context daemons"',
    "youmd stack daemon install || true",
    "youmd stack daemon status || true",
    "youmd status",
    'echo "[you.md] fresh-machine bootstrap complete: $ROOT"',
  ].join("\n");
}

export function buildFreshMachineBootstrapCommand(options: FreshMachineBootstrapOptions = {}): string {
  const assignments = [
    envAssignment("YOUMD_API_KEY", options.apiKey),
    envAssignment("YOUMD_CODE_ROOT", options.root),
    envAssignment("YOUMD_ACTIVE_DAYS", options.days ?? DEFAULT_FRESH_MACHINE_DAYS),
    envAssignment("YOUMD_PROJECT_LIMIT", options.limit ?? DEFAULT_FRESH_MACHINE_LIMIT),
    envAssignment("YOUMD_ENV_VAULT", options.envVaultPath),
  ].filter((value): value is string => Boolean(value));

  return `${assignments.join(" ")} bash -lc ${shellQuote(buildFreshMachineBootstrapScript())}`;
}

export function buildFreshMachineBootstrapPrompt(options: FreshMachineBootstrapOptions = {}): string {
  const root = options.root ?? DEFAULT_FRESH_MACHINE_ROOT;
  const days = options.days ?? DEFAULT_FRESH_MACHINE_DAYS;
  const limit = options.limit ?? DEFAULT_FRESH_MACHINE_LIMIT;
  const command = buildFreshMachineBootstrapCommand(options);

  return [
    "Fresh computer bootstrap for Claude Code / Codex:",
    "",
    "Copy this whole command into the new machine terminal:",
    "",
    "```bash",
    command,
    "```",
    "",
    `What it does: installs You.md, authenticates, pulls/syncs identity, restores shared agent skills/stacks, fetches and hydrates the persisted portfolio graph, previews the graph-backed project setup plan, creates ${root}, clones active projects from the last ${days} days, restores an encrypted env vault if supplied, rehydrates local evidence, audits cloned project readiness without reading secret values, and starts resident sync daemons.`,
    "",
    `Project source: You.md portfolio graph + authenticated GitHub recent repos, capped at ${limit} tracked projects before local audit evidence is merged.`,
    "Secret rule: .env.local values are never embedded here. Use YOUMD_ENV_VAULT or run the printed env restore command with your encrypted vault on the new machine.",
  ].join("\n");
}
