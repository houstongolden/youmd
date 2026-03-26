/**
 * ASCII portrait generator for the CLI.
 * Fetches a profile image URL, converts to ASCII art using luminance mapping.
 * Same algorithm as the web AsciiAvatar component but using jimp instead of canvas.
 */

import Jimp from "jimp";
import chalk from "chalk";

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
    // Fetch the image
    const image = await Jimp.read(imageUrl);

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
 * The YOU logo from the homepage — rendered as block characters in the terminal.
 * Uses the same pixel font data as the web PixelYOU component.
 */
const FONT: Record<string, number[][]> = {
  Y: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  O: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  U: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
};

export function printYouLogo(): void {
  const letters = ["Y", "O", "U"];
  const rows = 7;
  const cellChar = "\u2588"; // Full block █
  const emptyChar = " ";

  console.log("");

  for (let row = 0; row < rows; row++) {
    let line = "  ";
    for (let li = 0; li < letters.length; li++) {
      const letter = FONT[letters[li]];
      for (let col = 0; col < 5; col++) {
        line += letter[row][col] ? ACCENT(cellChar + cellChar) : emptyChar + emptyChar;
      }
      if (li < letters.length - 1) line += "  "; // gap between letters
    }
    console.log(line);
  }

  console.log("");
}
