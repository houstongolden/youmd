/**
 * ASCII portrait generator for the CLI.
 * Fetches a profile image URL, converts to ASCII art using luminance mapping.
 * Same algorithm as the web AsciiAvatar component but using jimp instead of canvas.
 */

import Jimp from "jimp";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

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
  const colored = options?.colored ?? true;

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
      let coloredLine = "";

      for (let x = 0; x < cols; x++) {
        const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
        const lum = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
        const charIndex = Math.floor((lum / 255) * (RAMP.length - 1));
        const ch = RAMP[charIndex];

        line += ch;
        if (colored) {
          coloredLine += lumToAnsi(lum)(ch);
        }
      }

      lines.push(line);

      // Print each line as it's generated (live rendering effect)
      if (colored) {
        process.stdout.write(`  ${coloredLine}\n`);
      } else {
        process.stdout.write(`  ${ACCENT(line)}\n`);
      }
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
  const portraitPath = path.join(bundleDir, "portrait.json");
  if (!fs.existsSync(portraitPath)) return false;

  try {
    const raw = JSON.parse(fs.readFileSync(portraitPath, "utf-8")) as {
      lines?: string[];
    };
    if (!raw.lines || raw.lines.length === 0) return false;

    const indent = options.indent ?? "  ";
    const maxLines = options.maxLines ?? raw.lines.length;
    const lines = raw.lines.slice(0, maxLines);

    for (const line of lines) {
      process.stdout.write(`${indent}${ACCENT(line)}\n`);
    }
    return true;
  } catch {
    return false;
  }
}
