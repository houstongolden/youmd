import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getLocalBundleDir, localBundleExists } from "../lib/config";
import { compileBundle } from "../lib/compiler";

const ACCENT = chalk.hex("#C46A3A");

export function previewCommand(options: { port?: string }): void {
  const port = parseInt(options.port || "3333", 10);

  console.log("");

  if (!localBundleExists()) {
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  const bundleDir = getLocalBundleDir();

  // Compile fresh bundle
  let youJson: Record<string, unknown> = {};
  let youMd = "";
  const youJsonPath = path.join(bundleDir, "you.json");
  const youMdPath = path.join(bundleDir, "you.md");

  try {
    const result = compileBundle(bundleDir);
    youJson = result.youJson;
    youMd = result.markdown;
  } catch {
    // Fall back to reading existing files
    if (fs.existsSync(youJsonPath)) {
      youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
    }
    if (fs.existsSync(youMdPath)) {
      youMd = fs.readFileSync(youMdPath, "utf-8");
    }
  }

  const identity = (youJson.identity || {}) as Record<string, unknown>;
  const name = (identity.name as string) || "you.md";

  const server = http.createServer((req, res) => {
    const url = req.url || "/";

    // CORS headers for agent access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const accept = req.headers.accept || "";

    if (url === "/you.json" || url === "/identity.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(youJson, null, 2));
      return;
    }

    if (url === "/you.md" || url === "/you.txt" || url === "/identity.md") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(youMd);
      return;
    }

    if (url === "/" || url === "/index.html") {
      // Content negotiation — agents get plain text, browsers get HTML
      if (accept.includes("application/json")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(youJson, null, 2));
        return;
      }

      if (accept.includes("text/plain") || accept.includes("text/markdown")) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(youMd);
        return;
      }

      // HTML preview for browsers
      const html = buildPreviewHtml(youJson, youMd, name, port);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  server.listen(port, () => {
    console.log(ACCENT("  you.md preview"));
    console.log("");
    console.log(`  serving ${chalk.dim(name)} on:`);
    console.log("");
    console.log(`    ${chalk.cyan(`http://localhost:${port}`)}          ${chalk.dim("html preview")}`);
    console.log(`    ${chalk.cyan(`http://localhost:${port}/you.json`)}  ${chalk.dim("machine-readable")}`);
    console.log(`    ${chalk.cyan(`http://localhost:${port}/you.md`)}    ${chalk.dim("agent-readable")}`);
    console.log("");
    console.log(chalk.dim("  press ctrl+c to stop"));
    console.log("");
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    server.close();
    console.log("");
    console.log(chalk.dim("  preview stopped"));
    console.log("");
    process.exit(0);
  });
}

function buildPreviewHtml(
  youJson: Record<string, unknown>,
  youMd: string,
  name: string,
  port: number
): string {
  const identity = (youJson.identity || {}) as Record<string, unknown>;
  const bio = (identity.bio as Record<string, string>) || {};
  const tagline = (identity.tagline as string) || "";
  const location = (identity.location as string) || "";
  const projects = (youJson.projects || []) as Array<Record<string, string>>;
  const values = (youJson.values || []) as string[];
  const links = (youJson.links || {}) as Record<string, string>;
  const preferences = (youJson.preferences || {}) as Record<string, unknown>;
  const agent = (preferences.agent || {}) as Record<string, unknown>;

  const projectsHtml = projects.map((p) =>
    `<div class="project">
      <span class="label">${p.name || "untitled"}</span>
      <span class="dim"> -- ${p.role || ""} (${p.status || ""})</span>
      ${p.description ? `<div class="dim">${p.description}</div>` : ""}
    </div>`
  ).join("");

  const valuesHtml = values.map((v) => `<li>${v}</li>`).join("");
  const linksHtml = Object.entries(links).map(([k, v]) =>
    `<li><span class="label">${k}:</span> <a href="${v}">${v}</a></li>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} -- you.md preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0D0D0D; color: #EAE6E1; font-family: 'JetBrains Mono', monospace; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #C46A3A; font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { color: #C46A3A; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; margin: 2rem 0 0.5rem; opacity: 0.8; }
    .dim { opacity: 0.6; }
    .label { color: #C46A3A; }
    .tagline { font-size: 1rem; opacity: 0.8; margin-bottom: 0.5rem; }
    .bio { margin: 1rem 0; opacity: 0.9; }
    .project { margin: 0.5rem 0; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.2rem 0; }
    li::before { content: "-- "; opacity: 0.4; }
    a { color: #C46A3A; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .endpoints { margin-top: 2rem; padding: 1rem; border: 1px solid rgba(234,230,225,0.1); border-radius: 2px; }
    .endpoints code { color: #C46A3A; }
    pre { background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 2px; overflow-x: auto; font-size: 0.85rem; margin: 0.5rem 0; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <div class="tagline">${tagline}</div>
  ${location ? `<div class="dim">${location}</div>` : ""}
  ${bio.medium ? `<div class="bio">${bio.medium}</div>` : bio.short ? `<div class="bio">${bio.short}</div>` : ""}

  ${projects.length ? `<h2>── projects ──</h2>${projectsHtml}` : ""}
  ${values.length ? `<h2>── values ──</h2><ul>${valuesHtml}</ul>` : ""}
  ${Object.keys(links).length ? `<h2>── links ──</h2><ul>${linksHtml}</ul>` : ""}
  ${agent.tone ? `<h2>── agent preferences ──</h2><div class="dim">tone: ${agent.tone}</div>` : ""}

  <div class="endpoints">
    <h2>── endpoints ──</h2>
    <ul>
      <li><code>GET /you.json</code> <span class="dim">machine-readable identity</span></li>
      <li><code>GET /you.md</code> <span class="dim">agent-readable markdown</span></li>
      <li><code>GET /</code> <span class="dim">content-negotiated (Accept header)</span></li>
    </ul>
    <pre>curl http://localhost:${port}/you.json
curl -H "Accept: text/plain" http://localhost:${port}/</pre>
  </div>
</body>
</html>`;
}
