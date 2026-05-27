# GStack / GBrain Reference Intelligence

Last updated: 2026-05-27T23:39:20.770Z

You.md keeps Garry Tan's GStack and GBrain as local reference repos, then turns upstream changes into reviewable tasks for YouStacks and the You.md brain/context layer. Reference repos are not vendored into this repository; they live under `.reference-repos/` and are ignored by git.

Run:

```bash
npm run references:sync
```

## GStack

- URL: https://github.com/garrytan/gstack
- Local path: `.reference-repos/garrytan/gstack`
- Branch: `main`
- Latest commit: `19770ea8b41d`
- Mode: Changes since a6fb317

- `19770ea` 2026-05-27 — v1.51.0.0 feat: $B memory diagnostic + 4 CDP-resource leak fixes (#1751)
  Files: `BROWSER.md`, `CHANGELOG.md`, `CLAUDE.md`, `SKILL.md`, `TODOS.md`, `VERSION`, `browse/SKILL.md`, `browse/src/browser-manager.ts`, +21 more

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `42d99b6fca3b`
- Mode: No new commits since 42d99b6

- No commits found.

## Candidate Tasks

- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 19770ea: v1.51.0.0 feat: $B memory diagnostic + 4 CDP-resource leak fixes (#1751)
