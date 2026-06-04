"use client";

/**
 * Terminal-native "continue with GitHub" control. No emoji, no illustration —
 * just a bordered monospace action line that kicks off the OAuth start route.
 * Free GitHub sign-up + sign-in both render this above the email flow.
 */
export function GithubAuthButton({
  nextPath = "/shell",
  label = "continue with github",
}: {
  nextPath?: string;
  label?: string;
}) {
  const href = `/api/auth/github/start?next=${encodeURIComponent(nextPath)}`;
  return (
    <a
      href={href}
      className="group flex items-center justify-between border border-[hsl(var(--border))] px-4 py-3 font-mono text-[13px] text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))] transition-colors"
      style={{ borderRadius: "2px" }}
    >
      <span className="opacity-90 group-hover:opacity-100">{label}</span>
      <span className="text-[hsl(var(--accent))] opacity-70 group-hover:opacity-100">
        {"→"}
      </span>
    </a>
  );
}

const GITHUB_ERROR_COPY: Record<string, string> = {
  github_unconfigured: "github sign-in is not configured yet.",
  github_missing_code: "github did not return an authorization code.",
  github_state_mismatch: "github sign-in expired or was tampered with. try again.",
  github_server_misconfigured: "github sign-in is temporarily unavailable.",
  access_denied: "github authorization was cancelled.",
};

export function githubErrorMessage(error: string | null): string | null {
  if (!error) return null;
  return GITHUB_ERROR_COPY[error] || `github sign-in failed: ${error}`;
}
