/**
 * ASCII portrait generator for the CLI.
 * Fetches a profile image URL, converts to ASCII art using luminance mapping.
 * Same algorithm as the web AsciiAvatar component but using jimp instead of canvas.
 */

import Jimp from "jimp";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { readGlobalConfig } from "./config";

const ACCENT = chalk.hex("#C46A3A");

// Character ramp — dark to light (same as web AsciiAvatar "classic" ramp)
const RAMP = `$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `;

// Luminance to terminal color (orange-tinted, matching the web version)
function lumToAnsi(l: number): chalk.Chalk {
  if (l < 25) return chalk.hidden;
  if (l < 55) return chalk.hex("#3D2010");
  if (l < 85) return chalk.hex("#5A3018");
  if (l < 115) return chalk.hex("#7A4020");
  if (l < 145) return chalk.hex("#9A5030");
  if (l < 175) return chalk.hex("#B06038");
  if (l < 205) return chalk.hex("#C47040");
  if (l < 230) return chalk.hex("#D48050");
  return chalk.hex("#E09060");
}

/**
 * Fetch an image URL and render it as colored ASCII art in the terminal.
 * Returns the ASCII lines as an array of strings (for potential saving).
 */
export async function renderAsciiPortrait(
  imageUrl: string,
  cols: number = 60,
  options?: { colored?: boolean }
): Promise<string[] | null> {
  const lines = await generateAsciiPortraitLines(imageUrl, cols);
  if (!lines) return null;

  const colored = options?.colored ?? true;
  for (const line of lines) {
    if (colored) {
      let coloredLine = "";
      for (const ch of line) {
        coloredLine += ACCENT(ch);
      }
      process.stdout.write(`  ${coloredLine}\n`);
    } else {
      process.stdout.write(`  ${ACCENT(line)}\n`);
    }
  }

  return lines;
}

export async function generateAsciiPortraitLines(
  imageUrl: string,
  cols: number = 60,
): Promise<string[] | null> {
  try {
    // Fetch the image with a timeout to avoid hanging on slow CDNs
    const image = await Promise.race([
      Jimp.read(imageUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("image fetch timed out")), 10000)
      ),
    ]);

    // Calculate rows maintaining aspect ratio (terminal chars are ~2x tall as wide)
    const rows = Math.floor(cols * (image.getHeight() / image.getWidth()) * 0.46);

    // Resize to target dimensions
    image.resize(cols, rows);

    // Apply contrast boost (similar to web version's ctx.filter)
    image.contrast(0.3);
    image.brightness(0.05);

    const lines: string[] = [];

    for (let y = 0; y < rows; y++) {
      let line = "";

      for (let x = 0; x < cols; x++) {
        const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
        const lum = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
        const charIndex = Math.floor((lum / 255) * (RAMP.length - 1));
        const ch = RAMP[charIndex];

        line += ch;
      }

      lines.push(line);
    }

    return lines;
  } catch {
    return null;
  }
}

/**
 * The YOU logo — large, clean block art inspired by the Vercel PLUGINS banner.
 * Brand is just "YOU" — not "YOU.MD". The .md is the format, not the brand.
 */

const LOGO_LINES = [
  "  ██╗   ██╗   ██████╗   ██╗   ██╗",
  "  ╚██╗ ██╔╝  ██╔═══██╗  ██║   ██║",
  "   ╚████╔╝   ██║   ██║  ██║   ██║",
  "    ╚██╔╝    ██║   ██║  ██║   ██║",
  "     ██║     ╚██████╔╝  ╚██████╔╝",
  "     ╚═╝      ╚═════╝    ╚═════╝ ",
];

export function printYouLogo(): void {
  const dim = chalk.dim;

  console.log("");

  for (const line of LOGO_LINES) {
    console.log(ACCENT(line));
  }

  console.log(dim("  ──────────────────────────────────"));
  console.log(dim("  you.md") + dim(" — identity for the agent internet"));
  console.log("");
}

export function printSavedPortrait(
  bundleDir: string,
  options: { maxLines?: number; indent?: string } = {}
): boolean {
  const lines = getSavedPortraitLines(bundleDir, options.maxLines);
  if (!lines) return false;

  const indent = options.indent ?? "  ";
  for (const line of lines) {
    process.stdout.write(`${indent}${ACCENT(line)}\n`);
  }
  return true;
}

export function getSavedPortraitLines(
  bundleDir: string,
  maxLines?: number,
): string[] | null {
  const portraitPath = path.join(bundleDir, "portrait.json");
  if (!fs.existsSync(portraitPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(portraitPath, "utf-8")) as {
      lines?: string[];
    };
    if (!raw.lines || raw.lines.length === 0) return null;

    const limit = maxLines ?? raw.lines.length;
    return raw.lines.slice(0, limit);
  } catch {
    return null;
  }
}

const BOT_LINES = [
  "  .-.",
  " (o o)  __",
  " | O | / /",
  " |   |/ /",
  " '~~~' /",
  "   \\__/ ",
];

function padRight(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function printPortraitEncounter(options: {
  bundleDir: string;
  displayName: string;
  recentProjects?: string[];
  currentProject?: string;
  portraitLines: string[];
}): boolean {
  const portraitLines = options.portraitLines.slice(0, 16);
  if (!portraitLines || portraitLines.length === 0) return false;

  const speechLines = [
    `hi ${options.displayName.split(" ")[0]}, i'm U.`,
    "i help other agents know you.",
    options.currentProject
      ? `let's look at ${options.currentProject} first.`
      : options.recentProjects && options.recentProjects.length > 0
        ? `lately you've been around ${options.recentProjects.slice(0, 3).join(", ")}.`
        : "let's see what you've been working on lately.",
    "*sipping bitbucks frappaccino*",
  ];

  const leftWidth = Math.max(...portraitLines.map((line) => line.length));
  const rightWidth = Math.max(...BOT_LINES.map((line) => line.length), ...speechLines.map((line) => line.length + 2));
  const totalLines = Math.max(portraitLines.length, BOT_LINES.length + speechLines.length + 1);

  for (let i = 0; i < totalLines; i++) {
    const left = portraitLines[i] || "";

    let right = "";
    if (i < BOT_LINES.length) {
      right = BOT_LINES[i];
    } else if (i === BOT_LINES.length) {
      right = "";
    } else {
      const speechIndex = i - BOT_LINES.length - 1;
      if (speechIndex >= 0 && speechIndex < speechLines.length) {
        right = speechIndex === 0
          ? `> ${speechLines[speechIndex]}`
          : `  ${speechLines[speechIndex]}`;
      }
    }

    const leftCell = left ? ACCENT(padRight(left, leftWidth)) : " ".repeat(leftWidth);
    const rightCell = right
      ? (i < BOT_LINES.length ? chalk.hex("#E09060")(padRight(right, rightWidth)) : chalk.dim(padRight(right, rightWidth)))
      : " ".repeat(rightWidth);

    process.stdout.write(`  ${leftCell}    ${rightCell}\n`);
  }

  return true;
}

export async function resolvePortraitLines(bundleDir: string): Promise<string[] | null> {
  const saved = getSavedPortraitLines(bundleDir, 16);
  if (saved && saved.length > 0) return saved;

  const inferredUrl = inferPortraitImageUrl(bundleDir);
  if (!inferredUrl) return null;

  return generateAsciiPortraitLines(inferredUrl, 44);
}

function inferPortraitImageUrl(bundleDir: string): string | null {
  const config = readGlobalConfig();
  if (config.avatarUrl) return config.avatarUrl;

  const youJsonPath = path.join(bundleDir, "you.json");
  if (!fs.existsSync(youJsonPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(youJsonPath, "utf-8")) as {
      links?: Record<string, string>;
    };
    const links = parsed.links || {};
    const github = links.github;
    if (github) {
      const match = github.match(/github\.com\/([^/]+)/i);
      if (match?.[1]) return `https://unavatar.io/github/${match[1]}`;
    }

    const xUrl = links["x/twitter"] || links.x || links.twitter;
    if (xUrl) {
      const match = xUrl.match(/(?:x\.com|twitter\.com)\/([^/]+)/i);
      if (match?.[1]) return `https://unavatar.io/x/${match[1]}`;
    }

    const linkedIn = links.linkedin;
    if (linkedIn) return `https://unavatar.io/linkedin/${encodeURIComponent(linkedIn)}`;
  } catch {
    return null;
  }

  return null;
}
