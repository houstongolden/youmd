# Lovable Design Reference

**Repo:** github.com/houstongolden/youmd-b73d50c7
**Local clone:** `/tmp/youmd-lovable/` (run `git clone https://github.com/houstongolden/youmd-b73d50c7 /tmp/youmd-lovable` if missing, or `cd /tmp/youmd-lovable && git pull` to update)
**Live preview:** youmd.lovable.app
**Stack:** Vite + React + Supabase + Tailwind (NOT Next.js, NOT Convex)

## Purpose & Rules

The Lovable app is a **design reference and feature wireframe playground**. Use it for:
- UI/UX patterns, layout, colors, spacing, component structure
- Feature prototypes and screen designs to port
- Design inspiration when asked to "check the lovable repo"

### CRITICAL RULES

1. **This project (Next.js + Convex) is ALWAYS the source of truth.** Never override core functionality based on Lovable code.
2. **Never blindly copy/paste Lovable code.** It uses Vite/React Router/Supabase. Recreate features properly within our Next.js App Router + Convex backend.
3. **UI/design CAN be closely matched.** The visual design is approved and good. Copy styling, layout, spacing, colors freely.
4. **For new features:** Extract the logic/purpose from Lovable, then build it properly in our stack.
5. **For existing features that Lovable improves:** Create improvements from scratch within our project. Don't graft Lovable code onto existing functionality.

## How to Use

When Houston says something like:
- "check the lovable repo for new screens/improvements"
- "port X from lovable"
- "use lovable as reference for Y"

Do this:
1. `cd /tmp/youmd-lovable && git pull` to get latest
2. Read the relevant files in `/tmp/youmd-lovable/src/`
3. Understand the design/feature intent
4. Implement properly in our Next.js + Convex stack

## Repo Structure

```
src/pages/
  Index.tsx              Landing page (hero + sections)
  ShellPage.tsx          Terminal editor (35/65 split) -- MOST IMPORTANT
  ProfilePage.tsx        Public profile detail view
  CreateProfilePage.tsx  Profile creation wizard
  ProfilesDirectory.tsx  Browse all profiles
  AuthTerminal.tsx       Auth flow page

src/components/shell/
  ShellPreviewPane.tsx   Pane router (dispatches to active pane)
  TerminalHeader.tsx     3-dot terminal title bar
  TerminalInput.tsx      Reusable terminal input w/ prompt
  TerminalLine.tsx       Single terminal output line
  panes/
    ProfilePreview.tsx   Identity summary + ASCII + metrics
    SettingsPane.tsx     Account, preferences, delete
    PrivateContextPane.tsx  Encrypted notes + private links/projects
    SourcesPane.tsx      Connected data sources
    TokensPane.tsx       API keys & tokens
    ActivityPane.tsx     Security log & events
    BillingPane.tsx      Plan, usage, billing
    PublishPane.tsx      Deploy status & version history
    PortraitPane.tsx     ASCII portrait settings
    AgentsPane.tsx       Agent network & access
    HelpPane.tsx         Command reference

src/components/landing/
  [Same sections as our landing page -- can reference for tweaks]

src/lib/
  freshness.ts           Freshness scoring (0-100, per-dimension)
  exportProfile.ts       Generate you.json & you.md for download
  profiles.ts            DB queries (Supabase -- adapt to Convex)

src/hooks/
  useYouAgent.ts         Agent personality, thinking phrases, reactions
```

## Key Features to Reference

### Shell Editor (ShellPage.tsx)
35/65 terminal + preview split. Slash commands switch panes: `/profile`, `/settings`, `/billing`, `/tokens`, `/activity`, `/sources`, `/portrait`, `/publish`, `/agents`, `/help`, `/private`, `/sync`. URL detection auto-scrapes sources.

### Private Context Vault (PrivateContextPane.tsx)
Encrypted notes (textarea), private links (add/remove), private projects (name + description + status). Real-time save with timestamp feedback.

### Freshness Scoring (freshness.ts)
Per-source decay (100 at sync, decays to 0 over 30 days). Per-dimension: identity, projects, voice, sources. Labels: current (80+), stale (50-80), outdated (20-50), unknown (<20).

### Export (exportProfile.ts)
Generate you.json (structured bundle) and you.md (markdown). Browser download trigger.

### Profile Page (ProfilePage.tsx)
Rich sections with staggered fade-in animation. Header + bio + now + projects + values + links + agent metrics + freshness. Raw JSON toggle. Copy link feedback.

### Profiles Directory (ProfilesDirectory.tsx)
Card grid with ASCII avatar preview. Search/filter.

## UI Patterns Reference

- **Section labels:** `> LABEL` in accent color, uppercase, mono, tracking-wider
- **Dividers:** `h-px bg-border my-4 sm:my-6`
- **Status dots:** `w-1.5 h-1.5 rounded-full bg-success` + pulse
- **Status icons:** synced=`check`, verified=`check`, pending=`...`, failed=`x`
- **Terminal panels:** 1px border, bg-card, 3-dot header, p-3/p-4
- **Responsive:** text-[10px] sm:text-[11px], p-3 sm:p-4
