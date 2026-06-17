export interface ProjectStrategyInput {
  projectName: string;
  stackName?: string;
  docs: {
    readme?: string;
    overview?: string;
    prd?: string;
    currentState?: string;
    todo?: string;
    tasks?: string;
    features?: string;
    design?: string;
    research?: string;
    ideas?: string;
    architecture?: string;
  };
  providers?: string[];
  recentActivityTitles?: string[];
  shippedToday?: number;
  shipped7d?: number;
  shipped30d?: number;
  fallbackSummary?: string;
}

export interface ProjectCompetitor {
  name: string;
  url?: string;
  note?: string;
}

export interface ProjectStrategyFields {
  detailedDescription?: string;
  goal?: string;
  vision?: string;
  positioning?: string;
  audience?: string;
  painPoints?: string[];
  solution?: string;
  whyThisSolution?: string;
  northStar?: string;
  metrics?: string[];
  constraints?: string[];
  notBuilding?: string[];
  competitors?: ProjectCompetitor[];
}

const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z][A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*)\s*=\s*[^\s,;]+/gi;
const SECRET_TOKEN_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
];

function redactSecrets(value: string): string {
  let cleaned = value.replace(SECRET_ASSIGNMENT_PATTERN, (_match, keyName: string) => `${keyName}=[REDACTED_SECRET]`);
  for (const pattern of SECRET_TOKEN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED_SECRET]");
  }
  return cleaned;
}

function cleanText(value: string | undefined, limit = 520): string | undefined {
  const text = redactSecrets(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return undefined;
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trim()}...` : text;
}

function cleanLine(value: string): string | undefined {
  const line = redactSecrets(value)
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
  if (!line || /^[-:|]+$/.test(line)) return undefined;
  return cleanText(line, 260);
}

function isSetupBoilerplate(value: string): boolean {
  const text = value.toLowerCase();
  const mentionsEnvSetup = /\b(?:copy|create|configure|add|set|update)\b/.test(text) && /\.env(?:\.example|\.local)?/.test(text);
  const mentionsLocalPreview = /\b(?:localhost|preview\/web|dev server)\b/.test(text) ||
    /\bcursor will expose\b/.test(text);
  const mentionsBuildCommand = /\b(?:compile|build)\b/.test(text) &&
    /\b(?:app|production|bundle|dist)\b/.test(text);
  return (
    /\b(requires?|install(?:ation)?|getting started|quick start|setup|setup script|dependencies|run|start)\b/.test(text) &&
    /\b(node\.?js|npm|pnpm|yarn|bun|nvm|localhost|\.env|docker|dev server|chmod|script|dependencies)\b/.test(text)
  ) || mentionsEnvSetup || mentionsLocalPreview || mentionsBuildCommand || /^\s*(npm|pnpm|yarn|bun|nvm|docker)\s+/i.test(value);
}

function unique(values: Array<string | undefined>, limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value, 260);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= limit) break;
  }
  return result;
}

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function headingMatches(heading: string, patterns: RegExp[]): boolean {
  const normalized = heading
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+\s+/, "");
  return patterns.some((pattern) => pattern.test(normalized));
}

function section(markdown: string | undefined, patterns: RegExp[]): string | undefined {
  const text = stripCodeBlocks(markdown ?? "");
  if (!text.trim()) return undefined;
  const lines = text.split("\n");
  let collecting = false;
  let startLevel = 0;
  const collected: string[] = [];

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const level = match[1].length;
      const title = match[2];
      if (collecting && level <= startLevel) break;
      if (!collecting && headingMatches(title, patterns)) {
        collecting = true;
        startLevel = level;
        continue;
      }
    }
    if (collecting) collected.push(line);
  }

  return cleanText(collected.join("\n"), 1400);
}

function firstParagraph(markdown: string | undefined, limit = 420): string | undefined {
  const text = stripCodeBlocks(markdown ?? "")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .find((block) => block.length > 24 && !block.startsWith("|") && !isSetupBoilerplate(block));
  return cleanText(text, limit);
}

function listFromSection(markdown: string | undefined, patterns: RegExp[], limit = 6): string[] {
  const sec = section(markdown, patterns);
  if (!sec) return [];
  const bulletLines = sec
    .split("\n")
    .filter((line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line))
    .map(cleanLine);
  if (bulletLines.length) return unique(bulletLines, limit);
  return unique(
    sec
      .split(/(?<=[.!?])\s+/)
      .map((line) => cleanLine(line))
      .filter((line): line is string => Boolean(line) && !isSetupBoilerplate(line as string)),
    limit
  );
}

function firstSectionParagraph(markdowns: Array<string | undefined>, patterns: RegExp[], limit = 520): string | undefined {
  for (const markdown of markdowns) {
    const sec = section(markdown, patterns);
    const paragraph = firstParagraph(sec, limit);
    if (paragraph) return paragraph;
  }
  return undefined;
}

function parseCompetitors(markdowns: Array<string | undefined>): ProjectCompetitor[] {
  const competitors: ProjectCompetitor[] = [];
  for (const markdown of markdowns) {
    const lines = listFromSection(markdown, [/competitors?/, /alternatives?/, /similar tools?/], 8);
    for (const line of lines) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(line);
      const rawName = link?.[1] ?? line.split(/\s[-:]\s/)[0] ?? line;
      const note = line.replace(link?.[0] ?? rawName, "").replace(/^\s*[-:]\s*/, "").trim();
      const name = cleanText(rawName, 80);
      if (!name) continue;
      competitors.push({
        name,
        url: link?.[2],
        note: cleanText(note, 180),
      });
    }
  }
  const seen = new Set<string>();
  return competitors.filter((competitor) => {
    const key = competitor.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function sourceDocs(input: ProjectStrategyInput): Array<string | undefined> {
  return [
    input.docs.prd,
    input.docs.overview,
    input.docs.currentState,
    input.docs.readme,
    input.docs.features,
    input.docs.todo,
    input.docs.tasks,
    input.docs.design,
    input.docs.research,
    input.docs.ideas,
    input.docs.architecture,
  ];
}

function listFromDocs(markdowns: Array<string | undefined>, patterns: RegExp[], limit = 8): string[] {
  return unique(markdowns.flatMap((markdown) => listFromSection(markdown, patterns, limit)), limit);
}

export function synthesizeProjectStrategy(input: ProjectStrategyInput): ProjectStrategyFields {
  const docs = sourceDocs(input);
  const summary =
    firstSectionParagraph(docs, [/what this project is/, /^overview$/, /^summary$/, /^about$/, /product surface/], 520) ??
    firstParagraph(input.docs.readme, 520) ??
    firstParagraph(input.docs.currentState, 520) ??
    firstParagraph(input.docs.prd, 520) ??
    cleanText(input.fallbackSummary, 520);
  const recent = unique(input.recentActivityTitles ?? [], 4);
  const providers = unique(input.providers ?? [], 8);

  const vision =
    firstSectionParagraph(docs, [/^vision$/, /core vision/, /what this project is/, /^overview$/, /product surface/], 520) ??
    summary;
  const goal =
    firstSectionParagraph(docs, [/^goal$/, /^goals$/, /objective/, /what done means/, /quality bar/], 420) ??
    vision;
  const solution =
    firstSectionParagraph(docs, [/^solution$/, /approach/, /how it works/], 460) ??
    summary;

  const metrics = unique([
    ...listFromSection(input.docs.prd, [/success metrics?/, /^metrics$/, /^kpis?$/, /north star/], 8),
    ...listFromSection(input.docs.currentState, [/latest/, /current state/, /verified/, /proof/], 4),
    `Shipping activity tracked: ${input.shippedToday ?? 0} today / ${input.shipped7d ?? 0} in 7d / ${input.shipped30d ?? 0} in 30d.`,
  ], 8);
  const painPoints = listFromDocs(docs, [/pain points?/, /^problem$/, /^problems$/, /^gaps?$/, /known issues?/, /broken/, /blocked/], 8);
  const constraints = unique([
    ...listFromDocs(docs, [/constraints?/, /guardrails?/, /non negotiables?/, /security/, /quality bar/], 8),
    providers.length ? "Never expose raw `.env.local` values, API keys, tokens, or decrypted secret contents." : undefined,
  ], 8);
  const notBuilding = listFromDocs(docs, [/not building/, /non goals?/, /out of scope/, /deferred/], 8);

  const detailedParts = unique([
    summary,
    recent.length ? `Recent activity: ${recent.join("; ")}.` : undefined,
    providers.length ? `Detected providers/services: ${providers.join(", ")}.` : undefined,
  ], 3);

  return {
    detailedDescription: cleanText(detailedParts.join(" "), 900),
    goal,
    vision,
    positioning:
      firstSectionParagraph(docs, [/positioning/, /target market/, /category/], 420) ??
      cleanText(`${input.projectName} is a ${input.stackName ?? "project"} in Houston's API/MCP/SkillStack-first project ecosystem.`, 420),
    audience:
      firstSectionParagraph(docs, [/audience/, /target users?/, /who .* for/, /users/], 360) ??
      cleanText("Houston, trusted coding agents, and authenticated local/remote agents working across the project portfolio.", 360),
    painPoints,
    solution,
    whyThisSolution:
      firstSectionParagraph(docs, [/why this solution/, /why .* works/, /why .* good/, /rationale/], 420) ??
      cleanText("It keeps project context, implementation evidence, reusable patterns, and agent actions in one portable graph instead of scattering them across one-off chats.", 420),
    northStar:
      firstSectionParagraph(docs, [/north star/, /primary metric/, /success metric/], 260) ??
      metrics[0],
    metrics,
    constraints,
    notBuilding,
    competitors: parseCompetitors(docs),
  };
}
