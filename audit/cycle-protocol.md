# Cycle Protocol — read this every fire

You are running an audit cycle for you.md. The user (Houston) wants this loop to
continue forever until he explicitly says stop.

## Step 1 — Check the lock

```bash
ls /Users/houstongolden/Desktop/CODE_2025/youmd/audit/.lock 2>/dev/null && echo LOCKED
```

If `LOCKED` is printed, exit immediately. Another cycle is in progress.
Otherwise: `touch audit/.lock` to claim the slot.

## Step 2 — Pick the work

1. Read `audit/improvements.md`. If there are unblocked **TODO** items, pick the
   top P0 (or top P1 if no P0, etc.). Do that fix. Skip to Step 4.
2. Otherwise, read `audit/queue.md` and pick the top unchecked item from NEXT.
   Move to Step 3.

## Step 3 — Audit the area

- For web routes: invoke the `/browse` skill from gstack. Take screenshots. Click
  every interactive element. Test mobile + desktop. Log findings.
- For API routes: curl with various accept headers, verify status codes, content
  types, and JSON shape.
- For CLI commands: run the command, observe output, verify behavior.
- For MCP: call the tool/resource and verify the response.

Append a `## Cycle N — <area> — <YYYY-MM-DD HH:MM>` block to `audit/findings.md`
with everything you saw.

For each issue found, append a TODO to `audit/improvements.md` with severity, file
path, and a one-line fix suggestion.

## Step 4 — Apply fix (if step 2 picked an improvement)

- Edit the file(s)
- Type-check: `npx tsc --noEmit`
- If types pass, commit and push:
  ```bash
  git add <files> && git commit -m "fix(qa-loop): <summary>" && git push
  ```
- Move the item to `## DONE` in improvements.md with the commit SHA

## Step 5 — Update queue

If you ran an audit (not a fix), check off the item in queue.md and move it to DONE.

## Step 6 — Release the lock

```bash
rm audit/.lock
```

## Step 7 — Report

Write a one-paragraph summary to the user with:
- Cycle number
- What was audited or fixed
- Critical findings (if any)
- What's next in the queue

## Critical rules

- ALWAYS hold the lock for the entire cycle so two cycles never overlap
- ALWAYS release the lock at the end (use `trap` if doing in shell)
- NEVER skip type-check before pushing
- NEVER mark anything DONE that wasn't actually verified working
- When in doubt, err on the side of finding more issues, not fewer
