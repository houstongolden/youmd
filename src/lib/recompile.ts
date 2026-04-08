/**
 * Recompile edited markdown files back into a patched youJson.
 * Takes the original youJson and a map of edited file paths -> content,
 * then patches the relevant sections.
 */

// Simple frontmatter-stripping helper
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

// Parse a bullet list from markdown
function parseBulletList(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => line.match(/^\s*[-*]\s/))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
}

// Known structured paths that get parsed back into youJson fields.
// Anything else gets stored in custom_files as an opaque markdown blob.
const STRUCTURED_PATHS = new Set([
  "profile/about.md",
  "profile/now.md",
  "profile/projects.md",
  "profile/values.md",
  "profile/links.md",
  "preferences/agent.md",
  "preferences/writing.md",
  "voice/voice.md",
  "voice/voice.linkedin.md",
  "voice/voice.x.md",
  "voice/voice.blog.md",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recompileYouJson(originalYouJson: any, editedFiles: Record<string, string>): any {
  // Deep clone to avoid mutation
  const yj = JSON.parse(JSON.stringify(originalYouJson));

  // Ensure custom_files array exists for unstructured edits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!Array.isArray(yj.custom_files)) yj.custom_files = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customFiles: Array<{ path: string; content: string; isPublic?: boolean }> =
    yj.custom_files;

  // Helper: upsert a custom file by path
  const upsertCustomFile = (path: string, rawContent: string) => {
    const existingIdx = customFiles.findIndex((f) => f && f.path === path);
    const isPublic = path.startsWith("profile/");
    if (existingIdx >= 0) {
      customFiles[existingIdx] = {
        ...customFiles[existingIdx],
        path,
        content: rawContent,
        isPublic,
      };
    } else {
      customFiles.push({ path, content: rawContent, isPublic });
    }
  };

  for (const [path, rawContent] of Object.entries(editedFiles)) {
    // Anything outside the known structured paths is treated as a custom file
    // (user-created or otherwise). Skip the known managed/read-only files.
    if (!STRUCTURED_PATHS.has(path)) {
      // Don't persist read-only managed paths via custom_files
      const isManaged =
        path === "you.md" ||
        path === "you.json" ||
        path === "manifest.json" ||
        path === "FOLDER.md" ||
        path.startsWith("memory/") ||
        path.startsWith("sessions/") ||
        path.startsWith("sources/");
      if (!isManaged) {
        upsertCustomFile(path, rawContent);
      }
      continue;
    }

    const content = stripFrontmatter(rawContent);

    switch (path) {
      case "profile/about.md": {
        // Parse name from first # heading, tagline, location, and bio
        const lines = content.split("\n");
        let name = "";
        let tagline = "";
        let location = "";
        const bioLines: string[] = [];
        let pastHeader = false;

        for (const line of lines) {
          if (line.startsWith("# ")) {
            name = line.replace(/^#\s+/, "").trim();
            pastHeader = true;
          } else if (!pastHeader) {
            continue;
          } else if (line.match(/^\*.*\*$/) && !location) {
            location = line.replace(/^\*|\*$/g, "").trim();
          } else if (line.trim() && !tagline && !line.startsWith("#")) {
            // First non-empty line after heading that's not location = tagline or bio start
            if (bioLines.length === 0 && line.length < 120) {
              tagline = line.trim();
            } else {
              bioLines.push(line);
            }
          } else if (pastHeader) {
            bioLines.push(line);
          }
        }

        if (!yj.identity) yj.identity = {};
        if (name) yj.identity.name = name;
        if (tagline) yj.identity.tagline = tagline;
        if (location) yj.identity.location = location;
        const bioText = bioLines.join("\n").trim();
        if (bioText) {
          if (!yj.identity.bio) yj.identity.bio = {};
          yj.identity.bio.long = bioText;
          // Auto-generate short/medium if they don't exist
          if (!yj.identity.bio.short) {
            yj.identity.bio.short = bioText.split(".")[0] + ".";
          }
        }
        break;
      }

      case "profile/now.md": {
        const items = parseBulletList(content);
        if (!yj.now) yj.now = {};
        yj.now.focus = items;
        yj.now.updated_at = new Date().toISOString().split("T")[0];
        break;
      }

      case "profile/projects.md": {
        // Parse ## headings as project names with metadata
        const projects: Array<{ name: string; role?: string; status?: string; url?: string; description?: string }> = [];
        let current: typeof projects[0] | null = null;
        const descLines: string[] = [];

        for (const line of content.split("\n")) {
          if (line.startsWith("## ")) {
            if (current) {
              current.description = descLines.join("\n").trim();
              projects.push(current);
              descLines.length = 0;
            }
            current = { name: line.replace(/^##\s+/, "").trim() };
          } else if (current) {
            if (line.startsWith("**Role:**")) {
              current.role = line.replace("**Role:**", "").trim();
            } else if (line.startsWith("**Status:**")) {
              current.status = line.replace("**Status:**", "").trim();
            } else if (line.startsWith("**URL:**")) {
              current.url = line.replace("**URL:**", "").trim();
            } else if (line.trim()) {
              descLines.push(line);
            }
          }
        }
        if (current) {
          current.description = descLines.join("\n").trim();
          projects.push(current);
        }
        yj.projects = projects;
        break;
      }

      case "profile/values.md": {
        yj.values = parseBulletList(content);
        break;
      }

      case "profile/links.md": {
        const links: Record<string, string> = {};
        for (const line of content.split("\n")) {
          const match = line.match(/^\s*[-*]\s+\*\*(.+?):\*\*\s*(.+)/);
          if (match) {
            links[match[1].trim()] = match[2].trim();
          }
        }
        if (Object.keys(links).length > 0) {
          yj.links = links;
        }
        break;
      }

      case "preferences/agent.md": {
        if (!yj.preferences) yj.preferences = {};
        if (!yj.preferences.agent) yj.preferences.agent = {};
        for (const line of content.split("\n")) {
          if (line.startsWith("**Tone:**")) {
            yj.preferences.agent.tone = line.replace("**Tone:**", "").trim();
          } else if (line.startsWith("**Formality:**")) {
            yj.preferences.agent.formality = line.replace("**Formality:**", "").trim();
          } else if (line.startsWith("**Avoid:**")) {
            yj.preferences.agent.avoid = line.replace("**Avoid:**", "").trim().split(",").map((s: string) => s.trim());
          }
        }
        break;
      }

      case "preferences/writing.md": {
        if (!yj.preferences) yj.preferences = {};
        if (!yj.preferences.writing) yj.preferences.writing = {};
        for (const line of content.split("\n")) {
          if (line.startsWith("**Style:**")) {
            yj.preferences.writing.style = line.replace("**Style:**", "").trim();
          } else if (line.startsWith("**Format:**")) {
            yj.preferences.writing.format = line.replace("**Format:**", "").trim();
          }
        }
        break;
      }

      case "voice/voice.md": {
        const body = content.replace(/^#.*\n*/m, "").trim();
        if (!yj.voice) yj.voice = {};
        yj.voice.overall = body;
        if (!yj.analysis) yj.analysis = {};
        yj.analysis.voice_summary = body;
        break;
      }

      case "voice/voice.linkedin.md":
      case "voice/voice.x.md":
      case "voice/voice.blog.md": {
        const body = content.replace(/^#.*\n*/m, "").trim();
        const platform = path.replace("voice/voice.", "").replace(".md", "");
        if (!yj.voice) yj.voice = {};
        if (!yj.voice.platforms) yj.voice.platforms = {};
        yj.voice.platforms[platform] = body;
        break;
      }
    }
  }

  // Update meta timestamp
  if (yj.meta) {
    yj.meta.last_updated = new Date().toISOString();
  }

  return yj;
}
