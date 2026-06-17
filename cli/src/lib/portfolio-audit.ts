import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

type ProviderCategory = "llm" | "auth" | "sms" | "email" | "hosting" | "database" | "browser" | "marketing" | "other";

interface EnvKeyRecord {
  key: string;
  provider: string;
  category: ProviderCategory;
  project: string;
  file: string;
  fingerprint?: string;
}

export interface PortfolioAuditResult {
  root: string;
  generatedAt: string;
  projectsScanned: number;
  envFilesScanned: number;
  providers: Array<{
    provider: string;
    category: ProviderCategory;
    projects: string[];
    keyNames: string[];
    envFiles: string[];
    sharedFingerprints: Array<{ fingerprint: string; projects: string[]; keyNames: string[] }>;
  }>;
  projects: Array<{
    name: string;
    path: string;
    envFiles: string[];
    providers: string[];
  }>;
}

const ENV_KEY_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".venv",
  "build",
  "DerivedData",
  "dist",
  "node_modules",
  "Pods",
  "target",
  "vendor",
]);

const PROVIDER_RULES: Array<{ provider: string; category: ProviderCategory; match: RegExp }> = [
  { provider: "OpenAI / OpenRouter", category: "llm", match: /(OPENAI|OPENROUTER|GPT|MODEL_PROVIDER)/ },
  { provider: "Anthropic", category: "llm", match: /(ANTHROPIC|CLAUDE)/ },
  { provider: "Resend", category: "email", match: /RESEND/ },
  { provider: "Sendblue", category: "sms", match: /SENDBLUE/ },
  { provider: "Twilio", category: "sms", match: /TWILIO/ },
  { provider: "Convex", category: "database", match: /CONVEX/ },
  { provider: "Supabase", category: "database", match: /SUPABASE/ },
  { provider: "Vercel", category: "hosting", match: /VERCEL/ },
  { provider: "GitHub", category: "auth", match: /GITHUB/ },
  { provider: "Google", category: "auth", match: /GOOGLE|GMAIL/ },
  { provider: "Lempod", category: "marketing", match: /LEMPOD/ },
  { provider: "Multilogin X", category: "browser", match: /MULTILOGIN/ },
  { provider: "E2B", category: "browser", match: /E2B/ },
  { provider: "Firecrawl", category: "other", match: /FIRECRAWL/ },
];

function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

function shouldScanEnvFile(fileName: string, includeDotenv: boolean): boolean {
  if (fileName === ".env.local") return true;
  if (fileName.startsWith(".env.") && fileName.endsWith(".local")) return true;
  return includeDotenv && fileName === ".env";
}

function looksLikeProject(files: string[]): boolean {
  return files.includes("package.json") ||
    files.includes("AGENTS.md") ||
    files.includes("CLAUDE.md") ||
    files.includes(".youmd-project") ||
    files.includes("next.config.ts") ||
    files.includes("vite.config.ts");
}

function inferProvider(rawKey: string): { provider: string; category: ProviderCategory } {
  const normalized = normalizeKeyName(rawKey);
  for (const rule of PROVIDER_RULES) {
    if (rule.match.test(normalized)) return { provider: rule.provider, category: rule.category };
  }
  const first = normalized.split("_")[0] || "Unknown";
  return { provider: first[0] + first.slice(1).toLowerCase(), category: "other" };
}

export function normalizeKeyName(rawKey: string): string {
  return rawKey
    .replace(/^(NEXT_PUBLIC_|NEXT_|VITE_|PUBLIC_|REACT_APP_)/, "")
    .replace(/_(SECRET|TOKEN|KEY|API_KEY|CLIENT_SECRET|CLIENT_ID)$/g, "_$1");
}

function parseEnvFile(filePath: string, options: { fingerprints: boolean; salt: string }): Array<{ key: string; fingerprint?: string }> {
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  const records: Array<{ key: string; fingerprint?: string }> = [];
  for (const line of text.split("\n")) {
    const match = line.match(ENV_KEY_RE);
    if (!match) continue;
    const key = match[1];
    let fingerprint: string | undefined;
    if (options.fingerprints) {
      const rawValue = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (rawValue) {
        fingerprint = crypto
          .createHmac("sha256", options.salt)
          .update(rawValue)
          .digest("hex")
          .slice(0, 12);
      }
    }
    records.push({ key, fingerprint });
  }
  return records;
}

function readOrCreateSalt(): string {
  const dir = path.join(os.homedir(), ".youmd");
  const saltPath = path.join(dir, ".secret-fingerprint-salt");
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(saltPath)) return fs.readFileSync(saltPath, "utf-8").trim();
    const salt = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(saltPath, salt + "\n", { mode: 0o600 });
    return salt;
  } catch {
    return "youmd-fingerprint-session-fallback";
  }
}

export function runPortfolioAudit(options: {
  root?: string;
  includeDotenv?: boolean;
  fingerprints?: boolean;
  activeDays?: number;
} = {}): PortfolioAuditResult {
  const root = path.resolve(expandHome(options.root ?? "~/Desktop/CODE_2025"));
  const includeDotenv = Boolean(options.includeDotenv);
  const fingerprints = Boolean(options.fingerprints);
  const activeDays = options.activeDays ?? 365;
  const cutoff = Date.now() - activeDays * 86_400_000;
  const salt = fingerprints ? readOrCreateSalt() : "";
  const projectDirs = new Map<string, { name: string; path: string; envFiles: string[] }>();
  const envRecords: EnvKeyRecord[] = [];

  function registerProject(dir: string, files: string[]): void {
    const stat = fs.statSync(dir);
    if (stat.mtimeMs < cutoff && !files.some((file) => shouldScanEnvFile(file, includeDotenv))) return;
    const name = path.basename(dir);
    projectDirs.set(dir, { name, path: dir, envFiles: [] });
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    if (looksLikeProject(files)) registerProject(dir, files);

    for (const fileName of files) {
      if (!shouldScanEnvFile(fileName, includeDotenv)) continue;
      const envPath = path.join(dir, fileName);
      const projectDir = projectDirs.get(dir) ?? { name: path.basename(dir), path: dir, envFiles: [] };
      projectDir.envFiles.push(envPath);
      projectDirs.set(dir, projectDir);
      for (const parsed of parseEnvFile(envPath, { fingerprints, salt })) {
        const inferred = inferProvider(parsed.key);
        envRecords.push({
          key: parsed.key,
          provider: inferred.provider,
          category: inferred.category,
          project: projectDir.name,
          file: envPath,
          fingerprint: parsed.fingerprint,
        });
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name) || entry.name.endsWith(".xcarchive")) continue;
      walk(path.join(dir, entry.name));
    }
  }

  walk(root);

  const providerNames = [...new Set(envRecords.map((record) => record.provider))].sort();
  const providers = providerNames.map((provider) => {
    const records = envRecords.filter((record) => record.provider === provider);
    const fingerprintGroups = new Map<string, EnvKeyRecord[]>();
    for (const record of records) {
      if (!record.fingerprint) continue;
      const group = fingerprintGroups.get(record.fingerprint) ?? [];
      group.push(record);
      fingerprintGroups.set(record.fingerprint, group);
    }
    return {
      provider,
      category: records[0]?.category ?? ("other" as ProviderCategory),
      projects: [...new Set(records.map((record) => record.project))].sort(),
      keyNames: [...new Set(records.map((record) => record.key))].sort(),
      envFiles: [...new Set(records.map((record) => path.relative(root, record.file)))].sort(),
      sharedFingerprints: [...fingerprintGroups.entries()]
        .map(([fingerprint, grouped]) => ({
          fingerprint,
          projects: [...new Set(grouped.map((record) => record.project))].sort(),
          keyNames: [...new Set(grouped.map((record) => record.key))].sort(),
        }))
        .filter((group) => group.projects.length > 1)
        .sort((a, b) => b.projects.length - a.projects.length),
    };
  });

  return {
    root,
    generatedAt: new Date().toISOString(),
    projectsScanned: projectDirs.size,
    envFilesScanned: [...projectDirs.values()].reduce((total, project) => total + project.envFiles.length, 0),
    providers,
    projects: [...projectDirs.values()]
      .map((project) => {
        const records = envRecords.filter((record) => record.project === project.name);
        return {
          name: project.name,
          path: path.relative(root, project.path) || ".",
          envFiles: project.envFiles.map((file) => path.relative(root, file)),
          providers: [...new Set(records.map((record) => record.provider))].sort(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
