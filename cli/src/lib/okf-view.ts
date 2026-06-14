/**
 * OKF brain view — a framework-agnostic view model over an OKF bundle plus a
 * self-contained HTML renderer.
 *
 * This is the substrate for two surfaces that should feel identical: the future
 * Obsidian-style desktop client and the web app. Both render the SAME view
 * model (`buildBrainView`) so an OKF bundle looks the same everywhere. The HTML
 * renderer is dependency-free (inline CSS, no JS, no network) so the generated
 * page opens locally as a "daily brain page" and seeds the desktop client.
 *
 * Pure — no filesystem. The CLI wraps it to read a directory or the live bundle.
 */

import matter from "gray-matter";
import { OkfBundleFile, OKF_VERSION, conceptId, conceptHref, isReservedFile } from "./okf";
import { auditOkfBundle, OkfHealthReport, OkfHealthOptions } from "./okf-health";

export interface BrainConcept {
  id: string;
  type: string;
  title: string;
  description?: string;
  lastUpdatedBy?: string;
  confidence?: string;
  linkedSources: string[];
  related: string[];
  href: string;
}

export interface BrainView {
  title: string;
  okfVersion: string;
  generatedAt: string;
  concepts: BrainConcept[];
  groups: Array<{ type: string; concepts: BrainConcept[] }>;
  edges: Array<{ from: string; to: string }>;
  health: OkfHealthReport;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

/** Read the bundle title from a root index.md `# Heading`, if present. */
function readIndexTitle(files: OkfBundleFile[]): string | undefined {
  const index = files.find((f) => f.path.replace(/\\/g, "/") === "index.md");
  if (!index) return undefined;
  const { content } = matter(index.content);
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : undefined;
}

/** Build the framework-agnostic view model from a set of OKF files. */
export function buildBrainView(
  files: OkfBundleFile[],
  options: { title?: string; now?: Date; staleDays?: number } = {},
): BrainView {
  const concepts: BrainConcept[] = [];

  for (const file of files) {
    const rel = file.path.replace(/\\/g, "/");
    if (!rel.toLowerCase().endsWith(".md") || isReservedFile(rel)) continue;
    const { data } = matter(file.content);
    const fm = (data || {}) as Record<string, unknown>;
    const id = conceptId(rel);
    concepts.push({
      id,
      type: typeof fm.type === "string" ? fm.type : "Untyped",
      title: typeof fm.title === "string" && fm.title.trim() ? fm.title : id,
      description: typeof fm.description === "string" ? fm.description : undefined,
      lastUpdatedBy: typeof fm.last_updated_by === "string" ? fm.last_updated_by : undefined,
      confidence: typeof fm.confidence === "string" ? fm.confidence : undefined,
      linkedSources: asStringArray(fm.linked_sources),
      related: asStringArray(fm.related),
      href: conceptHref(rel),
    });
  }

  concepts.sort((a, b) => a.id.localeCompare(b.id));

  const groupMap = new Map<string, BrainConcept[]>();
  for (const c of concepts) {
    const list = groupMap.get(c.type) || [];
    list.push(c);
    groupMap.set(c.type, list);
  }
  const groups = [...groupMap.entries()]
    .map(([type, cs]) => ({ type, concepts: cs }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const ids = new Set(concepts.map((c) => c.id));
  const edges: Array<{ from: string; to: string }> = [];
  for (const c of concepts) {
    for (const to of c.related) {
      if (ids.has(to)) edges.push({ from: c.id, to });
    }
  }

  const healthOpts: OkfHealthOptions = { now: options.now, staleDays: options.staleDays };
  const health = auditOkfBundle(files, healthOpts);

  return {
    title: options.title || readIndexTitle(files) || "You.md Brain",
    okfVersion: OKF_VERSION,
    generatedAt: (options.now || new Date()).toISOString(),
    concepts,
    groups,
    edges,
    health,
  };
}

// ─── HTML rendering ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A stable, URL-safe anchor id for a concept. */
function anchor(id: string): string {
  return "c-" + id.replace(/[^a-z0-9]+/gi, "-");
}

// Terminal-native palette (STYLE_GUIDE / PRD v2.3): monochrome + burnt orange,
// JetBrains Mono, dark default, 2px radius, no emoji.
const STYLE = `
:root{--bg:#0D0D0D;--raised:#161616;--border:#2A2A2A;--fg:#EDEDED;--dim:#8A8A8A;--accent:#C46A3A;--green:#5FB073}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6}
.wrap{max-width:980px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:20px;font-weight:500;letter-spacing:.02em;margin:0 0 4px}
.sub{color:var(--dim);margin:0 0 24px}
.bar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:0 0 28px}
.score{font-weight:500}
.panel{background:var(--raised);border:1px solid var(--border);border-radius:2px;margin:0 0 18px}
.panel .hd{border-bottom:1px solid var(--border);padding:8px 14px;color:var(--dim);display:flex;gap:6px;align-items:center}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.panel .bd{padding:14px}
.group-title{color:var(--accent);text-transform:lowercase;letter-spacing:.04em;margin:0 0 10px;font-weight:500}
.concept{border-top:1px solid var(--border);padding:12px 0}
.concept:first-child{border-top:none;padding-top:0}
.concept .t{font-weight:500}
.concept .d{color:var(--dim);margin:2px 0 6px}
.meta{color:var(--dim);font-size:12px;display:flex;gap:14px;flex-wrap:wrap}
.tag{border:1px solid var(--border);border-radius:2px;padding:1px 6px;color:var(--dim)}
.conf-low{color:var(--accent)}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.rel a{margin-right:10px}
.empty{color:var(--dim)}
footer{color:var(--dim);margin-top:28px;font-size:12px}
`;

function healthLine(h: OkfHealthReport): string {
  const color = h.score >= 80 ? "var(--green)" : h.score >= 50 ? "var(--accent)" : "#C0504D";
  const parts: string[] = [];
  const labels: Record<string, string> = {
    missing_type: "missing type",
    conflict: "conflicts",
    needs_review: "needs review",
    stale: "stale",
    unsourced: "un-sourced",
    no_description: "no description",
    orphan: "orphans",
  };
  for (const [k, label] of Object.entries(labels)) {
    const n = h.summary[k as keyof typeof h.summary];
    if (n) parts.push(`${esc(label)}: ${n}`);
  }
  return (
    `<span class="score" style="color:${color}">brain health: ${h.score}/100</span>` +
    `<span class="dim" style="color:var(--dim)">${h.totalConcepts} concepts</span>` +
    (parts.length ? `<span style="color:var(--dim)">${parts.join(" &middot; ")}</span>` : "")
  );
}

function renderConcept(c: BrainConcept, byId: Map<string, BrainConcept>): string {
  const rel = c.related
    .map((id) => {
      const t = byId.get(id);
      return t ? `<a href="#${anchor(id)}">${esc(t.title)}</a>` : `<span class="tag">${esc(id)}</span>`;
    })
    .join("");
  const meta: string[] = [];
  if (c.lastUpdatedBy) meta.push(`by ${esc(c.lastUpdatedBy)}`);
  if (c.confidence) {
    const cls = c.confidence === "low" ? ' class="conf-low"' : "";
    meta.push(`<span${cls}>confidence: ${esc(c.confidence)}</span>`);
  }
  if (c.linkedSources.length) meta.push(`${c.linkedSources.length} source(s)`);
  return (
    `<div class="concept" id="${anchor(c.id)}">` +
    `<div class="t">${esc(c.title)} <span class="tag">${esc(c.type)}</span></div>` +
    (c.description ? `<div class="d">${esc(c.description)}</div>` : "") +
    (meta.length ? `<div class="meta">${meta.join("")}</div>` : "") +
    (rel ? `<div class="meta rel">related: ${rel}</div>` : "") +
    `</div>`
  );
}

/** Render the brain view as a self-contained HTML page (no JS, no network). */
export function renderBrainHtml(view: BrainView): string {
  const byId = new Map(view.concepts.map((c) => [c.id, c]));
  const groups = view.groups
    .map(
      (g) =>
        `<section class="panel"><div class="hd"><span class="dot" style="background:#C0504D"></span>` +
        `<span class="dot" style="background:var(--accent)"></span><span class="dot" style="background:var(--green)"></span>` +
        `&nbsp;${esc(g.type)}</div><div class="bd">` +
        `<div class="group-title">${esc(g.type.toLowerCase())} (${g.concepts.length})</div>` +
        g.concepts.map((c) => renderConcept(c, byId)).join("") +
        `</div></section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(view.title)} — You.md Brain</title>
<style>${STYLE}</style></head>
<body><div class="wrap">
<h1>${esc(view.title)}</h1>
<p class="sub">Open Knowledge Format brain &middot; okf/${esc(view.okfVersion)} &middot; ${view.concepts.length} concepts &middot; ${view.edges.length} links</p>
<div class="bar">${healthLine(view.health)}</div>
${groups || '<p class="empty">No concepts found.</p>'}
<footer>Generated ${esc(view.generatedAt)} by You.md &middot; this page renders the same OKF model the web app and desktop client use.</footer>
</div></body></html>
`;
}
