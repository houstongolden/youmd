# 2026-06-16 — Local Agent Bootstrap Auth Confirmation

## Raw Request Capture

Houston clarified that You.md needs to feel ready for a fresh-machine local agent bootstrap within the next hour:

- install via the curl command from a new Mac / terminal / Codex / Claude Code session
- run the local You.md CLI and authenticate through a browser handoff
- terminal should use a familiar CLI login rhythm: "press Enter to open you.md/auth in your browser"
- the browser success page should clearly say the web session and local agent are authenticated
- success page should feel branded, centered, and alive, with a small ASCII portrait / YOU moment
- success page should tell the user they can close the tab, return to the local agent, or open `/shell`
- new-user and fresh-machine flows should make onboarding obvious from the terminal, not leave users guessing what command comes next

## Product Interpretation

The install/login/sync path is the first proof that You.md is not just a website. It is the user's portable agent runtime layer:

1. `curl -fsSL https://you.md/install.sh | bash`
2. `youmd login`
3. terminal prints the short code and waits for Enter before opening `/auth`
4. web approval resolves the device-flow request
5. browser shows a calm success page with identity/portrait context
6. terminal persists the API key and recommends `youmd pull`, `youmd sync`, then `you`

This keeps the personal API/MCP/YouStack vision grounded in a concrete local-agent ceremony: new machine, authenticate, hydrate context, resume work.

## Follow-Up Shape

- Publish the bumped CLI package after npm OTP (`youmd@0.8.2`) so the public curl installer receives the new terminal copy.
- Add a first-run guided `you` sequence that detects fresh auth with no local bundle and walks through pull/sync/skill install with one-question-at-a-time prompts.
- Expand the success page into a richer onboarding branch for truly new users once the device auth result can safely expose "new user / no profile bundle yet" state.
