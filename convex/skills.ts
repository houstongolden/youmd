import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./lib/auth";
import { pageArgs, clampPageSize } from "./lib/pagination";
import type { Doc } from "./_generated/dataModel";

// ── L9: skill outcome telemetry ──────────────────────────────

// ---------------------------------------------------------------------------
// Bundled skill content — full templates, seeded on deploy
// ---------------------------------------------------------------------------

const BUNDLED_SKILLS = [
  {
    name: "youstack-start",
    description: "Start local agents with identity, project state, active requests, skills, and next moves",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["profile.about", "preferences.agent", "directives.agent", "voice.overall"],
    content: `# youstack-start

Use this skill at the beginning of a local-agent session, or when the user says "continue", "what should we do next", "use you.md", "use youstack", or asks you to make an existing repo smarter for agents.

YouStack is the you.md operating layer for local agents: identity, project context, skills, memory, activity logs, and safe additive repo bootstrapping.

## Identity Context

- **About:** {{profile.about}}
- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}
- **Voice:** {{voice.overall}}

## First Calls

If the You.md MCP server is available, call these in order:

1. \`whoami\`
2. \`get_agent_brief\` with \`format: "markdown"\`
3. \`list_skills\`
4. \`use_skill\` with \`name: "youstack-start"\` if the skill has not already been loaded

If MCP is not available but the CLI is installed, use:

\`\`\`bash
youmd whoami
youmd skill list
youmd skill use youstack-start
\`\`\`

If neither is available, read the repo's normal instruction files first: \`AGENTS.md\`, \`CLAUDE.md\`, \`.cursor/rules/\`, \`.you/\`, and \`project-context/\`.

## Operating Loop

1. Read the entire user request and extract every actionable request.
2. Read local project instructions before designing or editing.
3. Check \`project-context/feature-requests-active.md\`, \`project-context/CURRENT_STATE.md\`, and \`project-context/TODO.md\` when present.
4. Pick the highest-value next move from real context, not a generic command list.
5. Act end-to-end: implement, verify, update trackers, and report what actually changed.
6. Prefer additive changes to generated agent layers (\`.you/\`, \`.claude/skills/youmd/\`, \`.codex/skills/youmd/\`) before rewriting mature human-owned docs.

## Skill Routing

Use the available You.md skills as follows:

- \`project-context-init\` when a repo lacks a usable project-context spine.
- \`claude-md-generator\` when a host-specific agent entrypoint is missing or stale.
- \`voice-sync\` after voice or communication preferences change.
- \`proactive-context-fill\` when identity or project context is thin.
- \`you-logs\` when the user wants proof of which agents accessed context.
- \`meta-improve\` after repeated sessions to convert corrections into better identity or skill instructions.

## Guardrails

- Do not ask the user to paste files you can read locally.
- Do not claim You.md pushed, published, linked, or wrote anything unless the tool or command actually succeeded.
- Do not overwrite existing \`AGENTS.md\`, \`CLAUDE.md\`, \`.cursor/rules\`, or project-context files wholesale. Merge or add a managed block.
- Do not stop at "here is a plan" when the user asked you to continue improving the stack.
- Save durable learnings as memories or project notes when the host supports it.

## Done Means

- The current request is tracked.
- The relevant code, skill, MCP, API, or docs surface is actually updated.
- The change is tested with the smallest meaningful local verification.
- Project trackers reflect the state honestly.
- The final response names what changed and what still needs production/user verification.`,
  },
  {
    name: "youstack-maintainer",
    description: "Organize, update, safely improve, and publish private-by-default YouStacks",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["profile.about", "preferences.agent", "directives.agent", "voice.overall"],
    content: [
      "# youstack-maintainer",
      "",
      "Use this skill when the user asks to create, organize, improve, update, share, publish, or audit YouStacks.",
      "",
      "## Core Rule",
      "",
      "You.md is the brain. YouStacks are named execution packages built on top of that brain.",
      "",
      "Keep stacks private by default. Never make a stack public, widen a scoped link, read private memory, write brain data, call connected tools, or push to a remote repo unless the user explicitly approves that exact action.",
      "",
      "## Startup",
      "",
      "1. If the You.md auto-upgrade helper exists, run it quietly before editing stack files:",
      "",
      "   ```bash",
      "   ~/.youmd/bin/youmd-auto-upgrade --quiet || true",
      "   ```",
      "",
      "2. Discover stack manifests from the current repo, `youstacks/`, `.you/youstack.json`, or the user's chosen stack folder.",
      "3. Run `youmd stack doctor --path <stack>`, then `youmd stack smoke --path <stack>` before trusting a manifest.",
      "4. Read the stack's `improvement`, `update`, `sharing`, and `accessPolicy` blocks before changing anything.",
      "5. Prefer local/static stack files first. Use You.md API/MCP only for protected brain retrieval, sync, tokens, grants, connected tools, hosted telemetry, or server-side actions.",
      "6. Brain-aware preflight: before asking the user basic repo questions, skim the current repo context if present:",
      "   - `project-context/CURRENT_STATE.md`",
      "   - `project-context/feature-requests-active.md`",
      "   - `project-context/TODO.md`",
      "   - `project-context/reference-intelligence/TASKS.md`",
      "7. Upstream-aware preflight: if a stack change touches shared agent rules, skills, scripts, prompts, host adapters, or distribution, check the current reference-intelligence task list for relevant GStack, GBrain, Agent Scripts, or The Library signals before designing the change.",
      "",
      "## Organize A Stack",
      "",
      "For each stack, make sure it has:",
      "",
      "- A clear human name, stable slug, domain, aliases, and tags.",
      "- Skills in `skills/<name>/SKILL.md`.",
      "- Workflows in `workflows/`.",
      "- Optional sub-agents in `subagents/`.",
      "- Examples and golden prompts in `examples/` or `prompts/`.",
      "- Smoke checks or eval notes in `tests/`.",
      "- Docs in `docs/`.",
      "- Host adapters for Claude Code, Codex, and Cursor.",
      "- Optional pointer-catalog entries for repo-owned skills, prompts, scripts, agents, and examples that should stay canonical in their source repo instead of being copied.",
      "- Typed dependencies between skills, sub-agents, prompts, scripts, and protected capabilities so install/use flows can pull prerequisites before the requested capability.",
      "- A read-only diagnostic path for manifest bloat, route ambiguity, adapter drift, update hygiene, and public-readiness gaps.",
      "- An improvement policy and update policy.",
      "- A private/public/scoped sharing policy with `private` as the default.",
      "",
      "## Improve A Stack",
      "",
      "Use safe signals first:",
      "",
      "- User corrections.",
      "- Failed or ambiguous route choices.",
      "- Smoke failures.",
      "- Evals and golden prompt regressions.",
      "- Repo diffs.",
      "- Repeated manual edits.",
      "- New docs or examples the user approves.",
      "- Reference-intelligence tasks that are relevant:",
      "  - GStack for local-first skills, host adapters, evals, QA/review/release loops, and upgrade flows.",
      "  - GBrain for durable memory, retrieval, sync, provenance, privacy, and startup context.",
      "  - Agent Scripts for canonical shared AGENTS/skills/scripts/hooks, pointer-style downstream rules, skill validation, and portable helper ergonomics.",
      "  - The Library for private-first catalogs, reference-based installs, typed dependencies, and cross-device/team distribution.",
      "",
      "Make the smallest useful improvement. Update skills, workflows, docs, examples, tests, and generated adapters together when the change affects more than one surface. Run `youmd stack smoke` again.",
      "Run `youmd stack doctor` first when a change is triggered by route misses, bloat, stale adapters, memory/resource issues, or a reference-intelligence task.",
      "",
      "## Source Of Truth Rules",
      "",
      "- Prefer pointers over copies when a skill, prompt, script, or agent is owned by another repo and should improve there first.",
      "- Use managed blocks or generated adapter files for downstream repos; preserve repo-local rules below the managed pointer.",
      "- Keep helper scripts dependency-light and portable unless the manifest explicitly declares the runtime.",
      "- Validate skill front matter after edits and before commit or publish.",
      "- Never install public internet skills into a private stack without owner review.",
      "- Pull dependencies first when a stack capability declares `skill:*`, `agent:*`, `prompt:*`, `script:*`, or `protected:*` requirements.",
      "",
      "## Visibility",
      "",
      "- `private`: default. Visible only to the owner and local agents with file access.",
      "- `scoped-link`: share a bounded install/grant with a teammate, friend, or contractor.",
      "- `team`: shared within an approved workspace/team.",
      "- `public-open`: inspectable, forkable, installable public stack. Strip secrets, private memories, proprietary prompts, private examples, and internal tool details first.",
      "",
      "When the user says \"make this stack public\", first prepare a public-readiness diff:",
      "",
      "1. Confirm the stack name and slug.",
      "2. List files that will become public.",
      "3. List protected capabilities that remain behind You.md auth.",
      "4. Remove or redact secrets, private memories, private context, private links, and proprietary prompts.",
      "5. Run smoke checks.",
      "6. Ask for final approval before publishing or pushing.",
      "",
      "## BAMFStack Lighthouse Pattern",
      "",
      "BAMFStack is the reference proof for an open YouStack:",
      "",
      "- One curl install.",
      "- Host-native skills and commands.",
      "- Local helper CLI.",
      "- Env-only API key handling.",
      "- Auto-upgrade preamble.",
      "- Capability discovery.",
      "- Deterministic workflow routing.",
      "- Read-only smoke test.",
      "- Read-only stack doctor/diagnostic pass.",
      "- Docs-quality examples.",
      "- Sync rule: update stack files, docs, API/MCP references, prompts, and tests together.",
      "",
      "Copy the pattern, not the private implementation. Keep proprietary prompts, product internals, credentials, private creator data, and sensitive actions behind authenticated BAMF or You.md API/MCP surfaces.",
      "",
      "## External Inspiration Map",
      "",
      "- GStack: product feel for installable agent operating systems.",
      "- GBrain: product feel for a durable shared brain across agents.",
      "- Agent Scripts: product feel for canonical shared rules, skills, scripts, hooks, and repo-owned skill symlinks that stay simple enough to maintain.",
      "- The Library: product feel for a private-first catalog where agentic assets are referenced, pulled on demand, synced, and shared without forcing everything into a public marketplace.",
    ].join("\n"),
  },
  {
    name: "machine-bootstrap",
    description: "Set up a fresh computer with You.md identity, skills, stacks, agent config, and active project repos",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["profile.about", "profile.projects", "preferences.agent", "directives.agent"],
    content: [
      "# machine-bootstrap",
      "",
      "Use this skill when the user is on a new Mac, Mac mini, laptop, virtual computer, cloud workstation, or agent host and wants their You.md identity, projects, skills, stacks, and local code workspace restored.",
      "",
      "You.md is the brain. The new machine should become a runnable local agent workstation, not just a copied folder.",
      "",
      "## Identity Context",
      "",
      "- **About:** {{profile.about}}",
      "- **Projects:** {{profile.projects}}",
      "- **Agent preferences:** {{preferences.agent}}",
      "- **Directives:** {{directives.agent}}",
      "",
      "## Default Flow",
      "",
      "1. Confirm whether this looks like a fresh machine:",
      "   - `youmd status`",
      "   - `test -d ~/Desktop/CODE_YOU && find ~/Desktop/CODE_YOU -maxdepth 1 -type d | wc -l`",
      "   - `git config user.name && git config user.email`",
      "   - `gh auth status`",
      "2. If the user is still on the old/source machine and wants a copy/paste handoff",
      "   for Claude Code or Codex on the new machine, generate it first:",
      "",
      "   ```bash",
      "   youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault",
      "   ```",
      "",
      "   If the web dashboard minted a scoped bootstrap key, the generated prompt may",
      "   include `YOUMD_API_KEY`. Treat that prompt as secret-bearing local setup",
      "   material and do not paste it into public chats, tickets, or docs.",
      "   Fresh-machine bootstrap keys must include the `vault` scope so the trusted",
      "   device can pull encrypted Secret Vault snapshots after login.",
      "   For bounded proof runs on a clean local root, add",
      "   `--max-clone-projects 2` or set `YOUMD_MAX_CLONE_PROJECTS=2`; omit that cap",
      "   on the real new machine.",
      "",
      "3. If You.md is not installed on the new machine, install it:",
      "",
      "   ```bash",
      "   curl -fsSL https://you.md/install.sh | bash",
      "   ```",
      "",
      "4. Authenticate and hydrate the local brain:",
      "",
      "   ```bash",
      "   youmd login --key \"$YOUMD_API_KEY\"  # or: youmd login",
      "   youmd pull",
      "   youmd sync",
      "   ```",
      "",
      "5. Restore shared agent skills, stack config, and host adapters:",
      "",
      "   ```bash",
      "   youmd machine setup",
      "   youmd skill install all",
      "   youmd skill sync",
      "   youmd skill link codex",
      "   youmd skill link claude",
      "   ```",
      "",
      "6. Hydrate the portfolio graph from You.md/GitHub records before cloning, then",
      "   preview the graph-backed setup plan before creating the desktop code workspace",
      "   and syncing truly active 30-day projects first:",
      "",
      "   ```bash",
      "   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 30 --limit 80",
      "   youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only --dry-run",
      "   youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only",
      "   ```",
      "",
      "7. Ask whether Houston wants to expand the workspace to all active projects",
      "   from the last 90 days before calling the full project clone set complete:",
      "",
      "   ```bash",
      "   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 90 --limit 80",
      "   youmd machine projects --root ~/Desktop/CODE_YOU --days 90 --recent-only --dry-run",
      "   youmd machine projects --root ~/Desktop/CODE_YOU --days 90 --recent-only",
      "   ```",
      "",
      "8. If GitHub auth is missing, help the user log in and rerun only the project",
      "   clone step:",
      "",
      "   ```bash",
      "   gh auth login",
      "   youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only",
      "   ```",
      "",
      "9. After projects are cloned and any encrypted env vault is restored, hydrate the",
      "   portfolio graph again so local README, project-context, git, PR, and env-key",
      "   evidence becomes visible to future agents:",
      "",
      "   ```bash",
      "   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 30 --limit 80",
      "   ```",
      "",
      "10. Run the secret-safe readiness audit and sync the proof summary:",
      "",
      "   ```bash",
      "   youmd machine verify --root ~/Desktop/CODE_YOU --max-projects 80 --write-report --sync-report",
      "   ```",
      "",
      "   This checks cloned directories, git remotes, package managers, standard",
      "   scripts, `.env.local` presence, `.env.example` presence, root agent docs, and",
      "   `project-context/` presence. It writes a secret-safe JSON proof artifact to",
      "   `~/.youmd/machine-reports/latest.json` and syncs only the compact proof",
      "   summary to the You.md machine dashboard. It does not read secret values,",
      "   upload raw logs, or launch every dev server.",
      "",
      "11. Only when Houston explicitly wants deeper local proof or the clean host has",
      "    enough time/CPU, run bounded package checks and dev-server probes:",
      "",
      "   ```bash",
      "   youmd machine verify --root ~/Desktop/CODE_YOU --max-projects 80 --install-deps --run-checks --probe-servers --write-report --sync-report",
      "   ```",
      "",
      "   The default check scripts are `typecheck`, `lint`, `test`, and `build`.",
      "   Override with `--check-scripts lint,build` when needed. Dependency installs",
      "   and dev-server probes are capped by default; tune with",
      "   `--max-install-projects`, `--max-server-projects`, and timeout flags.",
      "",
      "## Behind-the-Scenes Agent Operation",
      "",
      "- Use the You.md CLI and You Agent yourself before asking Houston to do manual",
      "  work. Prefer deterministic commands for setup and proof:",
      "  `youmd status`, `youmd whoami`, `youmd pull`, `youmd sync`,",
      "  `youmd machine prompt`, `youmd machine setup`,",
      "  `youmd skill install all`, `youmd skill sync`,",
      "  `youmd env vault list`, `youmd env vault pull`,",
      "  `youmd project portfolio-hydrate`, and `youmd machine verify`.",
      "- Use `you` / `youmd chat` when you need the You Agent to synthesize context,",
      "  route a natural-language request, or produce the setup artifact, then turn the",
      "  result into concrete shell actions.",
      "- Do not stop to ask \"what next?\" after each setup phase. Continue through the",
      "  command, verify the result, and report concise proof.",
      "- Interrupt Houston only for true human-gated steps: GitHub browser auth,",
      "  macOS Keychain/passphrase entry, npm OTP, OS permissions, or the explicit",
      "  90-day project expansion choice.",
      "- If the installed CLI is stale, run the curl installer/update path first, then",
      "  retry the You.md command. Tell Houston when npm publish is needed for",
      "  `npx youmd@latest` or npm fallback installs.",
      "",
      "## Project Bootstrap Rules",
      "",
      "- Use repo directory names from GitHub URLs. `https://github.com/houstongolden/foldermd` becomes `foldermd`.",
      "- Default to projects active in the last 30 days and marked active plus Top",
      "  Priority/Focusing in You.md. Ask before expanding to the 90-day active set.",
      "- Ask before including older, archived, paused, inactive, on-ice, abandoned,",
      "  killed, dormant, or unsorted projects.",
      "- Create the workspace root on the Desktop if it is missing. `CODE_YOU` is the default fresh-machine root.",
      "- Use the You.md Portfolio Graph as the strategic source of truth, then merge",
      "  authenticated GitHub recent-repo data and local bundle project records so repo",
      "  names and URLs stay cloneable.",
      "- `youmd machine projects` should fetch the persisted owner graph through the",
      "  You.md API when authenticated. If that graph is unavailable, fall back to the",
      "  local bundle plus authenticated GitHub scan and say so.",
      "- Clone with `gh repo clone owner/repo <target>` when `gh` is authenticated; otherwise fall back to `git clone`.",
      "- Skip non-empty directories instead of overwriting them.",
      "- Never print secrets. If `.env.local` files are needed, use You.md Secret Vault",
      "  or the shared encrypted env backup/restore path. Never paste raw env values",
      "  into chat.",
      "- After cloning, initialize missing per-repo agent context with `youmd skill init-project` from inside that repo.",
      "",
      "## Secret-Safe Env Transfer",
      "",
      "Audit local project env coverage before backup:",
      "",
      "```bash",
      "~/.agent-shared/bin/env-key-audit.py --root ~/Desktop/CODE_2025",
      "~/.agent-shared/bin/env-secure-backup.sh --preflight",
      "youmd env backup --root ~/Desktop/CODE_2025 --preflight",
      "```",
      "",
      "Primary path: from the old/source machine, create an encrypted archive and push",
      "only the ciphertext plus safe manifest metadata to You.md Secret Vault:",
      "",
      "```bash",
      "youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault",
      "youmd env vault list",
      "```",
      "",
      "The passphrase is still local/trusted-device material. If the new machine needs",
      "headless restore, store the passphrase in macOS Keychain once from a normal",
      "trusted Terminal. Input is silent and the value is not printed:",
      "",
      "```bash",
      "read -rs \"PW?You.md vault passphrase: \" && \\",
      "security add-generic-password -a \"$USER\" -s youmd-env-vault -w \"$PW\" -U && \\",
      "unset PW && echo \"stored in Keychain\"",
      "```",
      "",
      "On the new machine, pull the latest encrypted account snapshot and restore into",
      "already-cloned project directories without clobbering local agent auth:",
      "",
      "```bash",
      "youmd env vault pull --out ~/.youmd/secret-vault",
      "youmd env vault pull --restore --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth",
      "```",
      "",
      "Fallback path: create an encrypted archive from the old machine in an",
      "interactive macOS terminal and transfer the encrypted file by iCloud, AirDrop,",
      "USB, or private password-manager attachment:",
      "",
      "```bash",
      "open ~/.agent-shared/bin/env-backup-interactive.command",
      "youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault",
      "```",
      "",
      "On the new machine, list the encrypted archive by path only before restore:",
      "",
      "```bash",
      "~/.agent-shared/bin/env-secure-restore.sh --archive ~/Desktop/env-local-backup.tar.gz.gpg --list",
      "youmd env restore ~/Desktop/env-local-backup.tar.gz.gpg --root ~/Desktop/CODE_YOU --list --map-existing --existing-only --skip-agent-auth",
      "youmd env restore ~/Desktop/env-local-backup.tar.gz.gpg --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth",
      "```",
      "",
      "If a headless agent reports that Keychain service `youmd-env-vault` is missing,",
      "do not make it guess. Print the Keychain command above, have Houston run it once",
      "on the trusted device, then rerun only the restore/setup command.",
      "",
      "## Useful Variants",
      "",
      "Dry-run the project layout:",
      "",
      "```bash",
      "youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only --dry-run",
      "```",
      "",
      "Create directories only, without cloning:",
      "",
      "```bash",
      "youmd machine projects --root ~/Desktop/CODE_YOU --no-clone",
      "```",
      "",
      "Audit cloned readiness:",
      "",
      "```bash",
      "youmd machine verify --root ~/Desktop/CODE_YOU --max-projects 80 --write-report --sync-report",
      "```",
      "",
      "Run bounded package checks:",
      "",
      "```bash",
      "youmd machine verify --root ~/Desktop/CODE_YOU --run-checks --max-check-projects 8 --check-timeout-ms 120000",
      "```",
      "",
      "Run clean-host dependency installs and localhost dev-server probes:",
      "",
      "```bash",
      "youmd machine verify --root ~/Desktop/CODE_YOU --install-deps --probe-servers --write-report --sync-report",
      "```",
      "",
      "Include older projects without prompts:",
      "",
      "```bash",
      "youmd machine projects --root ~/Desktop/CODE_YOU --yes",
      "```",
      "",
      "Generate the copy/paste prompt for a new Claude Code or Codex terminal:",
      "",
      "```bash",
      "youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault",
      "```",
      "",
      "Generate the same prompt but cap clones for a clean-host proof run:",
      "",
      "```bash",
      "youmd machine prompt --root /tmp/youmd-clean-host-CODE_YOU --days 30 --limit 80 --max-clone-projects 2 --require-env-vault",
      "```",
      "",
      "Fetch the secret-safe project graph directly:",
      "",
      "```bash",
      "curl -H \"Authorization: Bearer $YOUMD_API_KEY\" https://you.md/api/v1/me/portfolio/graph",
      "```",
      "",
      "## Done Means",
      "",
      "- You.md CLI is installed and authenticated.",
      "- The local bundle is pulled/synced.",
      "- Shared skills/stacks/agent config are restored.",
      "- A Desktop code root exists.",
      "- Active GitHub-backed project repos are cloned into matching repo-name directories.",
      "- The clone plan visibly used the persisted portfolio graph, authenticated",
      "  GitHub recent repos, and local bundle records with source counts.",
      "- `youmd machine verify` reports git/package/env/agent-doc/project-context",
      "  readiness for the cloned workspace without reading `.env.local` values and",
      "  writes `~/.youmd/machine-reports/latest.json`.",
      "- `--sync-report` creates or updates an owner-gated You.md machine proof row",
      "  that the dashboard can show across computers.",
      "- If `--run-checks` was requested, bounded package checks ran with project and",
      "  timeout caps, and failures/timeouts were reported per project.",
      "- If `--install-deps` or `--probe-servers` was requested, dependency installs",
      "  and localhost server probes ran with project and timeout caps, and the proof",
      "  report shows install/check/server pass counts.",
      "- The portfolio graph is hydrated from both remote project records and local",
      "  code/project-context/env-key evidence.",
      "- `.env.local` files, if restored, came from encrypted vault tooling without",
      "  printing raw values.",
      "- Older projects are either explicitly included or intentionally skipped.",
      "- The user can launch Claude Code or Codex inside the workspace and run `you`.",
    ].join("\n"),
  },
  {
    name: "portfolio-graph-auditor",
    description: "Audit active projects, API/MCP dependencies, env providers, service accounts, and reusable patterns",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["profile.projects", "preferences.agent", "directives.agent"],
    content: [
      "# Portfolio Graph Auditor",
      "",
      "Use this skill when the work touches Houston's cross-project operating map:",
      "active projects, project goals, API/MCP ownership, dependency direction,",
      "public skill stacks, protected in-product agent harnesses, reusable code/UI",
      "patterns, service accounts, env key names, or duplicate endpoint risk.",
      "",
      "## Contract",
      "",
      "- Treat You.md as the additive portfolio graph and source-catalog layer.",
      "- Keep canonical ownership in the owning repo or stack. Do not move BAMF,",
      "  SciStack, GStack, or product-stack source files into You.md.",
      "- Never print `.env.local` values, API keys, tokens, OTPs, passwords, private",
      "  keys, or decrypted backup contents.",
      "- Use key names, file paths, provider names, account login hints, redacted",
      "  fingerprints, and encrypted vault references instead of raw secret values.",
      "- Distinguish public/installable skill stacks from protected product-agent",
      "  harnesses. Public stacks teach agents how to use API/MCP safely; protected",
      "  app harnesses can contain proprietary prompts, workflows, tools, and client",
      "  context that should not be exposed through public stack installs.",
      "- Before creating a new API endpoint, check whether an already-connected",
      "  project owns that capability.",
      "",
      "## Default Workflow",
      "",
      "1. Inventory recent projects, preferring active work in the last year:",
      "   - `youmd status`",
      "   - `youmd project list`",
      "   - `youmd project portfolio-audit --root ~/Desktop/CODE_2025`",
      "2. Verify local agent startup context can see the portfolio graph:",
      "   - call the You.md MCP `get_agent_brief` tool, or read `youmd://agent/brief`",
      "   - confirm the brief includes `## Portfolio Graph`, `portfolio-graph-auditor`,",
      "     API/MCP ownership, reusable patterns, and env-audit commands",
      "   - read `youmd://portfolio/graph` when a client needs structured JSON",
      "3. Run the shared secret-safe env key audit:",
      "   - `~/.agent-shared/bin/env-key-audit.py --root ~/Desktop/CODE_2025`",
      "4. When duplicate key values matter, use only local salted fingerprints:",
      "   - `youmd project env-audit --root ~/Desktop/CODE_2025 --fingerprints`",
      "   - Do not paste fingerprints into public docs unless they are HMAC prefixes",
      "     generated by the local You.md salt.",
      "5. Update the You.md project context:",
      "   - `project-context/PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md`",
      "   - `project-context/feature-requests-active.md`",
      "   - `project-context/TODO.md`",
      "   - `project-context/FEATURES.md`",
      "   - `project-context/CHANGELOG.md`",
      "6. If the audit finds a reusable pattern, record:",
      "   - canonical owner project",
      "   - tech stack tags",
      "   - status: canonical, candidate, or deprecated",
      "   - source files or docs",
      "   - safe extraction plan",
      "7. If the audit finds an API/MCP dependency, record:",
      "   - dependent project",
      "   - owning project and stack",
      "   - integration tier: dependent, feature, optional, dev-only, admin,",
      "     workspace, or user-level",
      "   - features powered",
      "   - failure impact",
      "   - auth mode and write policy",
      "8. If the audit finds service-account drift, record account metadata only:",
      "   - provider",
      "   - login hint or owner note",
      "   - billing owner",
      "   - separation policy",
      "   - encrypted storage/vault reference",
      "",
      "## Lempod Rule",
      "",
      "Before building or changing Lempod management APIs:",
      "",
      "1. Audit `bamfaiapp` and `bamfsite`.",
      "2. Identify whether BAMFStack or BAMFOSStack is the canonical owner.",
      "3. Record whether the other project is dependent, feature-level, optional,",
      "   admin-only, workspace-level, or user-level.",
      "4. Do not create duplicate Lempod account-management endpoints unless the split",
      "   is explicit and documented.",
      "",
      "## Reusable Pattern Targets",
      "",
      "Prioritize these recurring patterns for cataloging:",
      "",
      "- API/MCP/SkillStack-first architecture",
      "- role hierarchy: solo user, workspace member/manager/admin/owner, super-admin",
      "- first-party passwordless auth with Resend/Sendblue; avoid paid auth",
      "  providers by default",
      "- full-height left sidebar app shell",
      "- agentic split workspace: chat plus detail pane",
      "- streaming agent acknowledgement and live task-list pattern",
      "- no dead loading spinners",
      "- no boxes-within-boxes admin/docs surfaces",
      "- protected harness versus public stack boundary",
      "",
      "## Quality Gate",
      "",
      "Before calling an audit done:",
      "",
      "- run `youmd project portfolio-audit --root ~/Desktop/CODE_2025`",
      "- verify `get_agent_brief` or `youmd://agent/brief` includes `## Portfolio Graph`",
      "- verify `youmd://portfolio/graph` is available for structured local-agent reads",
      "- run `~/.agent-shared/bin/env-key-audit.py --root ~/Desktop/CODE_2025`",
      "- confirm no secret values were printed",
      "- update You.md docs/tasks/changelog with the findings",
      "- if this skill changed, run `/Users/houstongolden/.agent-shared/bin/sync-agent-shared.sh`",
      "  and update `/Users/houstongolden/.agent-shared/STACK-MAP.md`",
    ].join("\n"),
  },
  {
    name: "claude-md-generator",
    description: "Generate CLAUDE.md for the current project, pre-loaded with your identity context",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["preferences.agent", "directives.agent", "voice.overall"],
    content: `# claude-md-generator

Generate a CLAUDE.md for the current project, pre-loaded with your identity so every coding agent knows who you are and how you work.

## Identity Context (resolved at install time)

- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}
- **Voice:** {{voice.overall}}

## What This Skill Does

1. Detect project type (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
2. Read existing CLAUDE.md or project-context/ if present
3. Generate CLAUDE.md with:
   - Your identity summary (who you are, what you're building)
   - Your agent preferences (how coding agents should behave)
   - Your directives (rules agents must follow)
   - Your voice profile (so agents match your communication style)
   - Detected project stack and structure
4. Write file (merge with existing, don't overwrite)

## Output Template

\`\`\`markdown
# {{project_name}} — Coding Agent Operating Manual

## Who You're Working With

{{profile.about}}

## Working Style

{{preferences.agent}}

## Directives

{{directives.agent}}

## Voice & Communication

{{voice.overall}}

## Project Stack

(auto-detected from project files)

## Project Structure

(auto-detected directory listing)
\`\`\`

## When To Use

- Starting a new project
- Onboarding a new coding agent (Claude Code, Cursor, Codex)
- After significant identity updates via \`youmd chat\` or \`youmd push\`
- When \`youmd skill sync\` detects identity changes affecting this skill`,
  },
  {
    name: "project-context-init",
    description: "Scaffold a project-context/ directory with PRD, TODO, features, changelog, and decision log",
    version: "1.0.0",
    scope: "project" as const,
    identityFields: ["preferences.agent", "profile.about"],
    content: `# project-context-init

Scaffold a complete project-context/ directory in any repo — pre-populated with your identity and agent preferences.

## Identity Context (resolved at install time)

- **Agent preferences:** {{preferences.agent}}
- **About you:** {{profile.about}}

## What This Skill Does

1. Detect project root (walk up to .git, package.json, etc.)
2. Create \`project-context/\` directory with:
   - \`PRD.md\` — Product requirements (empty template with your identity header)
   - \`TODO.md\` — Task tracking
   - \`FEATURES.md\` — Feature inventory with status
   - \`CHANGELOG.md\` — Dated change log
   - \`ARCHITECTURE.md\` — System architecture notes
   - \`CURRENT_STATE.md\` — What's deployed, what's broken
   - \`STYLE_GUIDE.md\` — Design system reference
   - \`feature-requests-active.md\` — Active request tracker
3. Pre-populate headers with your identity
4. Skip files that already exist (never overwrite)

## Directory Structure Created

\`\`\`
project-context/
├── PRD.md
├── TODO.md
├── FEATURES.md
├── CHANGELOG.md
├── ARCHITECTURE.md
├── CURRENT_STATE.md
├── STYLE_GUIDE.md
└── feature-requests-active.md
\`\`\`

## When To Use

- Starting any new project
- As part of \`youmd skill init-project\` (compound command)
- When adopting the project-context pattern in an existing repo`,
  },
  {
    name: "voice-sync",
    description: "Sync your voice profile across all agent tools — consistent tone everywhere",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["voice.overall", "voice.writing", "voice.speaking"],
    content: `# voice-sync

Keep your voice profile in sync across every agent tool you use. When your voice changes in one place, it propagates everywhere.

## Identity Context (resolved at sync time)

- **Overall voice:** {{voice.overall}}
- **Writing voice:** {{voice.writing}}
- **Speaking voice:** {{voice.speaking}}

## What This Skill Does

1. Read your current voice profile from the identity context
2. Generate agent-specific voice instructions for:
   - **Claude Code** (.claude/skills/youmd/voice.md)
   - **Cursor** (.cursor/rules/youmd-voice.md)
   - **Custom agents** (.youmd/skills/voice-context.md)
3. Re-render on every \`youmd skill sync\` or \`youmd push\`
4. Respect scope — shared voice propagates to all projects

## Sync Targets

| Agent | File | Format |
|---|---|---|
| Claude Code | .claude/skills/youmd/voice.md | Markdown with voice rules |
| Cursor | .cursor/rules/youmd-voice.md | Single markdown file |
| Generic | .youmd/skills/voice-context.md | Universal format |

## When To Use

- After updating your voice via \`youmd chat\`
- When \`youmd skill sync\` runs automatically
- When linking a new agent with \`youmd skill link\``,
  },
  {
    name: "meta-improve",
    description: "Self-improvement protocol — agents review their own effectiveness and propose identity updates",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["preferences.agent", "directives.agent"],
    content: `# meta-improve

The feedback loop that makes your identity smarter over time. Agents review what worked and what didn't, then propose updates to your identity context.

## Identity Context (resolved at review time)

- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}

## What This Skill Does

1. Read skill-metrics.json for usage data (which skills run, success/fail rates)
2. Analyze patterns:
   - Which skills get used most?
   - Which identity fields get referenced most?
   - Are there gaps? (skills that should exist but don't)
   - Are there stale entries? (skills never used)
3. Propose changes:
   - New directives based on repeated corrections
   - Voice refinements based on agent interactions
   - Skill additions based on detected workflow patterns
   - Pruning of unused skills
4. Present proposals for user approval (never auto-apply)

## Metrics Tracked

\`\`\`json
{
  "skills": {
    "claude-md-generator": {
      "uses": 12,
      "lastUsed": "2026-03-25T...",
      "avgDuration": 1200,
      "successRate": 0.92
    }
  },
  "identityFields": {
    "voice.overall": { "references": 45 },
    "preferences.agent": { "references": 38 }
  },
  "proposals": []
}
\`\`\`

## When To Use

- Periodically via \`youmd skill improve\`
- After a significant number of skill uses (auto-suggested)
- When onboarding a new project (review what's working)`,
  },
  {
    name: "proactive-context-fill",
    description: "Detect thin identity context and offer safe additive improvements",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["profile.projects", "profile.about", "preferences.agent", "voice.overall"],
    content: `# proactive-context-fill

Use this skill when starting a new session with a user who has a you.md identity bundle. It detects thin or missing context and proposes safe additive improvements.

## Detection Rules

1. **Projects:** If the identity references projects but the project context is thin, offer to scaffold missing project context.
2. **Voice:** If voice guidance is sparse, offer to derive a better voice profile from existing writing samples and preferences.
3. **Directives:** If agent directives are generic, offer to extract more explicit rules from recent conversations.
4. **Sources:** If profile links exist but source coverage is thin, offer to scrape and add them.
5. **Memories:** If there are very few memories, offer to seed initial memories from the current conversation.

## Guardrails

- Never overwrite user-owned files automatically.
- Present changes as additive proposals.
- Batch suggestions into a short, concrete list instead of asking ten questions at once.
- If project instructions are already robust, prefer adding a managed bootstrap block or \`.you/\` supplements over rewriting top-level docs.

## When To Use

- At the start of a new session when the identity bundle is obviously incomplete
- After major profile or project changes
- When a user wants You.md to improve their agent setup without clobbering what they already maintain`,
  },
  {
    name: "you-logs",
    description: "View recent agent activity and identity access logs inline",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: [],
    content: `# you-logs

Show recent agent activity for the current user.

## What It Does

Fetches recent agent activity from you.md and renders it as a terminal-friendly table showing:
- Time of activity
- Agent name
- Action performed
- Resource touched
- Bundle version diffs for writes

## How To Use It

Run:

\`\`\`bash
youmd logs --limit 30
\`\`\`

Pass through flags for filtering:

\`\`\`bash
youmd logs --limit 30 --agent "Claude Code"
youmd logs --action push
youmd logs --tail
\`\`\`

## When To Use

- When you want to see which agents touched your identity
- When debugging cross-agent context drift
- When reviewing whether shared instructions and skills are actually being used`,
  },
];

/**
 * Internal mutation — seeds bundled skills with full content.
 * Run via: npx convex run skills:seedBundledSkills
 * Idempotent: updates existing skills if name matches, skips if already current.
 */
export const seedBundledSkills = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let created = 0;

    for (const skill of BUNDLED_SKILLS) {
      const existing = await ctx.db
        .query("skills")
        .withIndex("by_name", (q) => q.eq("name", skill.name))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          description: skill.description,
          version: skill.version,
          scope: skill.scope,
          identityFields: skill.identityFields,
          content: skill.content,
          isPublished: true,
          updatedAt: Date.now(),
        });
        updated++;
      } else {
        // Find any user to use as authorId (use first user)
        const anyUser = await ctx.db.query("users").first();
        if (!anyUser) continue;
        await ctx.db.insert("skills", {
          authorId: anyUser._id,
          name: skill.name,
          description: skill.description,
          version: skill.version,
          scope: skill.scope,
          identityFields: skill.identityFields,
          content: skill.content,
          isPublished: true,
          downloads: 0,
          createdAt: Date.now(),
        });
        created++;
      }
    }

    return { updated, created, total: BUNDLED_SKILLS.length };
  },
});

// ── Queries ──────────────────────────────────────────────────

/**
 * Browse published skills in the registry.
 */
export const listPublished = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_isPublished", (q) => q.eq("isPublished", true))
      .collect();

    return skills
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, args.limit ?? 50)
      .map(toRegistrySkill);
  },
});

/** Shared public registry shape for listPublished / listPublishedPage (P13). */
function toRegistrySkill(s: Doc<"skills">) {
  return {
    _id: s._id,
    name: s.name,
    description: s.description,
    version: s.version,
    scope: s.scope,
    identityFields: s.identityFields,
    downloads: s.downloads,
    authorId: s.authorId,
    createdAt: s.createdAt,
  };
}

/**
 * P13: cursor-paginated registry browse. Pages in downloads-desc order via
 * the by_isPublished_downloads index (same documented ordering as
 * listPublished; ties between equal download counts break newest-first by
 * index order instead of the legacy in-memory stable sort).
 */
export const listPublishedPage = query({
  args: {
    ...pageArgs,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("skills")
      .withIndex("by_isPublished_downloads", (q) => q.eq("isPublished", true))
      .order("desc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: clampPageSize(args.numItems),
      });

    return { ...result, page: result.page.map(toRegistrySkill) };
  },
});

/**
 * Get skills published by a specific user.
 */
export const listByAuthor = query({
  args: {
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .collect();

    return skills.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get a single skill by name.
 */
export const getByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Get user's installed skills.
 * Cycle 44: added auth. Previously leaked installed-skills list per user.
 */
export const listInstalls = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    const installs = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return installs.sort((a, b) => b.installedAt - a.installedAt);
  },
});

/**
 * P13: cursor-paginated variant of listInstalls. Pages in installedAt-desc
 * order via the by_userId_installedAt index — identical to the legacy
 * in-memory sort.
 */
export const listInstallsPage = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    ...pageArgs,
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    return await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_installedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: clampPageSize(args.numItems),
      });
  },
});

// ── Mutations ────────────────────────────────────────────────

/**
 * Publish a skill to the registry.
 */
export const publish = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    name: v.string(),
    description: v.string(),
    version: v.string(),
    scope: v.union(v.literal("shared"), v.literal("project"), v.literal("private")),
    identityFields: v.array(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    // Check if skill name already exists
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // Only the author can update
      if (existing.authorId !== user._id) {
        throw new Error("Skill name already taken by another author");
      }
      // Update existing
      await ctx.db.patch(existing._id, {
        description: args.description,
        version: args.version,
        scope: args.scope,
        identityFields: args.identityFields,
        content: args.content,
        updatedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    // Create new
    const skillId = await ctx.db.insert("skills", {
      authorId: user._id,
      name: args.name,
      description: args.description,
      version: args.version,
      scope: args.scope,
      identityFields: args.identityFields,
      content: args.content,
      isPublished: true,
      downloads: 0,
      createdAt: Date.now(),
    });

    return { id: skillId, updated: false };
  },
});

/**
 * Record a skill installation for a user.
 */
export const recordInstall = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
    source: v.string(),
    scope: v.string(),
    identityFields: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    // Check if already installed
    const existing = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (existing) {
      // Update existing install
      await ctx.db.patch(existing._id, {
        source: args.source,
        scope: args.scope,
        identityFields: args.identityFields,
        installedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    const installId = await ctx.db.insert("skillInstalls", {
      userId: user._id,
      skillName: args.skillName,
      source: args.source,
      scope: args.scope,
      identityFields: args.identityFields,
      installedAt: Date.now(),
      lastUsedAt: 0,
      useCount: 0,
    });

    // Increment download count on the registry skill if it exists
    const registrySkill = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.skillName))
      .first();
    if (registrySkill) {
      await ctx.db.patch(registrySkill._id, {
        downloads: registrySkill.downloads + 1,
      });
    }

    return { id: installId, updated: false };
  },
});

/**
 * Track a skill usage event.
 */
export const trackUsage = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const install = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (install) {
      await ctx.db.patch(install._id, {
        useCount: install.useCount + 1,
        lastUsedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * L9 — Record a skill outcome (success / failure / partial).
 *
 * Auth: caller must be the authenticated owner (same path as publish /
 * recordInstall). Rejects unknown outcome values via the standard pattern
 * (throw + message string) so the HTTP layer surfaces them in the error envelope.
 */
export const recordOutcome = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
    outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("partial")),
    agent: v.optional(v.string()),
    note: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const id = await ctx.db.insert("skillOutcomes", {
      userId: user._id,
      skillName: args.skillName.trim().slice(0, 200),
      outcome: args.outcome,
      agent: typeof args.agent === "string" ? args.agent.slice(0, 100) : undefined,
      note: typeof args.note === "string" ? args.note.slice(0, 500) : undefined,
      durationMs: typeof args.durationMs === "number" && args.durationMs >= 0
        ? Math.round(args.durationMs)
        : undefined,
      createdAt: Date.now(),
    });

    return { id, skillName: args.skillName, outcome: args.outcome };
  },
});

/**
 * L10 — Per-skill aggregate insights for the authenticated user.
 *
 * Returns success / failure / partial counts + success rate for each skill
 * the user has outcome rows for. Sorted by uses desc, capped at 50 rows so
 * the CLI table stays scannable.
 */
export const activityInsights = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    // Collect all outcome rows for this user (index-backed, no table scan).
    const rows = await ctx.db
      .query("skillOutcomes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Aggregate per skill.
    const agg = new Map<string, {
      uses: number;
      success: number;
      failure: number;
      partial: number;
      lastUsedAt: number;
    }>();

    for (const row of rows) {
      const existing = agg.get(row.skillName) ?? {
        uses: 0, success: 0, failure: 0, partial: 0, lastUsedAt: 0,
      };
      existing.uses += 1;
      if (row.outcome === "success") existing.success += 1;
      else if (row.outcome === "failure") existing.failure += 1;
      else existing.partial += 1;
      if (row.createdAt > existing.lastUsedAt) existing.lastUsedAt = row.createdAt;
      agg.set(row.skillName, existing);
    }

    const insights = Array.from(agg.entries())
      .map(([skill, counts]) => ({
        skill,
        uses: counts.uses,
        success: counts.success,
        failure: counts.failure,
        partial: counts.partial,
        successRate: counts.uses > 0 ? counts.success / counts.uses : 0,
        lastUsedAt: counts.lastUsedAt,
      }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 50);

    return insights;
  },
});

/**
 * Remove a skill installation.
 */
export const removeInstall = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const install = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (install) {
      await ctx.db.delete(install._id);
    }

    return { success: true };
  },
});
