"use client";

const HELP_TEXT = `NAVIGATION
  /profile          view your identity profile
  /settings         account preferences
  /billing          plan & usage
  /tokens           api keys management
  /activity         agent reads & sync log
  /sources          connected data sources
  /portrait         ascii portrait settings
  /publish          deploy status & history
  /agents           agent network & access

VIEW MODES
  /public           preview as public visitors see
  /private          preview with private context

IDENTITY
  /sync             re-sync all connected sources
  /portrait         regenerate ascii portrait
  /publish          publish latest changes

CONTEXT MANAGEMENT
  set context <key> <value>
  add source <url>
  remove source <name>

AGENT COMMANDS
  set access <public|verified|private>
  set update-mode <auto|review|manual>

GENERAL
  /help             show this reference
  clear             clear terminal
  exit              leave shell`;

export function HelpPane() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          help
        </span>
      </div>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <h2 className="font-mono text-sm text-[hsl(var(--text-primary))] mb-6">
          you.md shell reference
        </h2>

        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <pre className="font-mono text-[11px] leading-loose text-[hsl(var(--text-primary))] opacity-70 whitespace-pre-wrap sm:whitespace-pre overflow-x-auto">
            {HELP_TEXT}
          </pre>
        </div>

        <div className="mt-6 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
          you can also type naturally -- the agent understands free-form input.
        </div>
      </div>
    </div>
  );
}
