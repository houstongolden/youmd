import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

export interface ProfileSection {
  slug: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface PreferenceSection {
  slug: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface YouBundle {
  version: number;
  generatedAt: string;
  profile: ProfileSection[];
  preferences: PreferenceSection[];
}

export interface ManifestEntry {
  file: string;
  type: "profile" | "preference";
  slug: string;
  hash: string;
}

export interface Manifest {
  version: number;
  generatedAt: string;
  entries: ManifestEntry[];
}

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function slugFromFilename(filename: string): string {
  return path.basename(filename, ".md");
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function readMarkdownFile(filePath: string): { slug: string; title: string; content: string; metadata: Record<string, unknown> } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const slug = slugFromFilename(filePath);
  const title = (data.title as string) || titleFromSlug(slug);

  return {
    slug,
    title,
    content: content.trim(),
    metadata: data,
  };
}

export function readDirectory(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

export interface CompileResult {
  bundle: YouBundle;
  markdown: string;
  manifest: Manifest;
  filesRead: Array<{ type: "profile" | "preference"; file: string }>;
}

export function compileBundle(bundleDir: string): CompileResult {
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  const profileFiles = readDirectory(profileDir);
  const preferenceFiles = readDirectory(preferencesDir);

  const filesRead: Array<{ type: "profile" | "preference"; file: string }> = [];

  // Read profile sections
  const profileSections: ProfileSection[] = profileFiles.map((file) => {
    filesRead.push({ type: "profile", file });
    return readMarkdownFile(path.join(profileDir, file));
  });

  // Read preference sections
  const preferenceSections: PreferenceSection[] = preferenceFiles.map((file) => {
    filesRead.push({ type: "preference", file });
    return readMarkdownFile(path.join(preferencesDir, file));
  });

  // Determine version
  const manifestPath = path.join(bundleDir, "manifest.json");
  let version = 1;
  if (fs.existsSync(manifestPath)) {
    try {
      const existingManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      version = (existingManifest.version || 0) + 1;
    } catch {
      // Start at version 1 if manifest is corrupted
    }
  }

  const generatedAt = new Date().toISOString();

  // Build you.json bundle
  const bundle: YouBundle = {
    version,
    generatedAt,
    profile: profileSections,
    preferences: preferenceSections,
  };

  // Build you.md composite markdown
  const markdownParts: string[] = [];
  markdownParts.push("# You.md Identity Bundle");
  markdownParts.push("");
  markdownParts.push(`> Generated at ${generatedAt} (v${version})`);
  markdownParts.push("");

  if (profileSections.length > 0) {
    markdownParts.push("## Profile");
    markdownParts.push("");
    for (const section of profileSections) {
      markdownParts.push(`### ${section.title}`);
      markdownParts.push("");
      markdownParts.push(section.content);
      markdownParts.push("");
    }
  }

  if (preferenceSections.length > 0) {
    markdownParts.push("## Preferences");
    markdownParts.push("");
    for (const section of preferenceSections) {
      markdownParts.push(`### ${section.title}`);
      markdownParts.push("");
      markdownParts.push(section.content);
      markdownParts.push("");
    }
  }

  const markdown = markdownParts.join("\n").trimEnd() + "\n";

  // Build manifest
  const manifestEntries: ManifestEntry[] = [];

  for (const file of profileFiles) {
    const content = fs.readFileSync(path.join(profileDir, file), "utf-8");
    manifestEntries.push({
      file: `profile/${file}`,
      type: "profile",
      slug: slugFromFilename(file),
      hash: simpleHash(content),
    });
  }

  for (const file of preferenceFiles) {
    const content = fs.readFileSync(path.join(preferencesDir, file), "utf-8");
    manifestEntries.push({
      file: `preferences/${file}`,
      type: "preference",
      slug: slugFromFilename(file),
      hash: simpleHash(content),
    });
  }

  const manifest: Manifest = {
    version,
    generatedAt,
    entries: manifestEntries,
  };

  return { bundle, markdown, manifest, filesRead };
}

export function writeBundle(bundleDir: string, result: CompileResult): void {
  fs.writeFileSync(
    path.join(bundleDir, "you.json"),
    JSON.stringify(result.bundle, null, 2) + "\n"
  );
  fs.writeFileSync(path.join(bundleDir, "you.md"), result.markdown);
  fs.writeFileSync(
    path.join(bundleDir, "manifest.json"),
    JSON.stringify(result.manifest, null, 2) + "\n"
  );
}
