"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// ---------------------------------------------------------------------------
// ASCII character ramps — same as client-side AsciiAvatar component
// ---------------------------------------------------------------------------

const RAMPS: Record<string, string> = {
  classic: `$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `,
  braille: "\u28FF\u28F7\u28F6\u28E6\u28E4\u2884\u2880\u2840\u2800",
  block: "\u2588\u2593\u2592\u2591 ",
  minimal: "@%#*+=-:. ",
};

function lumToColor(l: number): string {
  if (l < 25) return "transparent";
  if (l < 55) return "hsl(20 50% 10%)";
  if (l < 85) return "hsl(20 55% 16%)";
  if (l < 115) return "hsl(20 58% 24%)";
  if (l < 145) return "hsl(20 60% 34%)";
  if (l < 175) return "hsl(20 60% 42%)";
  if (l < 205) return "hsl(20 60% 52%)";
  if (l < 230) return "hsl(22 55% 60%)";
  return "hsl(24 50% 72%)";
}

// ---------------------------------------------------------------------------
// Minimal PNG decoder — handles most profile avatar PNGs
// Supports: 8-bit RGBA, 8-bit RGB, 8-bit grayscale
// ---------------------------------------------------------------------------

function decodePNG(buffer: Uint8Array): { width: number; height: number; data: Uint8Array } | null {
  try {
    // Verify PNG signature
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== sig[i]) return null;
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks: Uint8Array[] = [];

    while (offset < buffer.length) {
      const length = (buffer[offset] << 24) | (buffer[offset + 1] << 16) |
                     (buffer[offset + 2] << 8) | buffer[offset + 3];
      const type = String.fromCharCode(
        buffer[offset + 4], buffer[offset + 5],
        buffer[offset + 6], buffer[offset + 7]
      );

      if (type === "IHDR") {
        width = (buffer[offset + 8] << 24) | (buffer[offset + 9] << 16) |
                (buffer[offset + 10] << 8) | buffer[offset + 11];
        height = (buffer[offset + 12] << 24) | (buffer[offset + 13] << 16) |
                 (buffer[offset + 14] << 8) | buffer[offset + 15];
        bitDepth = buffer[offset + 16];
        colorType = buffer[offset + 17];
      } else if (type === "IDAT") {
        idatChunks.push(buffer.slice(offset + 8, offset + 8 + length));
      } else if (type === "IEND") {
        break;
      }

      offset += 12 + length; // 4 (length) + 4 (type) + length + 4 (CRC)
    }

    if (!width || !height || idatChunks.length === 0) return null;
    if (bitDepth !== 8) return null; // Only support 8-bit

    // Concatenate IDAT chunks
    const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
    const compressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, pos);
      pos += chunk.length;
    }

    // Decompress using Node.js zlib
    const zlib = require("zlib");
    const decompressed = zlib.inflateSync(Buffer.from(compressed));

    // Determine bytes per pixel
    let bpp = 0;
    switch (colorType) {
      case 0: bpp = 1; break; // Grayscale
      case 2: bpp = 3; break; // RGB
      case 4: bpp = 2; break; // Grayscale + Alpha
      case 6: bpp = 4; break; // RGBA
      default: return null;
    }

    // Unfilter
    const stride = width * bpp;
    const rgba = new Uint8Array(width * height * 4);
    const raw = new Uint8Array(decompressed);

    // Previous row for filtering
    const prevRow = new Uint8Array(stride);
    let rawOffset = 0;

    for (let y = 0; y < height; y++) {
      const filterType = raw[rawOffset++];
      const curRow = new Uint8Array(stride);

      for (let x = 0; x < stride; x++) {
        const rawByte = raw[rawOffset++];
        const a = x >= bpp ? curRow[x - bpp] : 0;
        const b = prevRow[x];
        const c = x >= bpp ? prevRow[x - bpp] : 0;

        switch (filterType) {
          case 0: curRow[x] = rawByte; break; // None
          case 1: curRow[x] = (rawByte + a) & 0xFF; break; // Sub
          case 2: curRow[x] = (rawByte + b) & 0xFF; break; // Up
          case 3: curRow[x] = (rawByte + Math.floor((a + b) / 2)) & 0xFF; break; // Average
          case 4: { // Paeth
            const p = a + b - c;
            const pa = Math.abs(p - a);
            const pb = Math.abs(p - b);
            const pc = Math.abs(p - c);
            const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            curRow[x] = (rawByte + pr) & 0xFF;
            break;
          }
          default: curRow[x] = rawByte;
        }
      }

      // Convert to RGBA
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;
        switch (colorType) {
          case 0: // Grayscale
            rgba[dstIdx] = rgba[dstIdx + 1] = rgba[dstIdx + 2] = curRow[x];
            rgba[dstIdx + 3] = 255;
            break;
          case 2: // RGB
            rgba[dstIdx] = curRow[x * 3];
            rgba[dstIdx + 1] = curRow[x * 3 + 1];
            rgba[dstIdx + 2] = curRow[x * 3 + 2];
            rgba[dstIdx + 3] = 255;
            break;
          case 4: // Grayscale + Alpha
            rgba[dstIdx] = rgba[dstIdx + 1] = rgba[dstIdx + 2] = curRow[x * 2];
            rgba[dstIdx + 3] = curRow[x * 2 + 1];
            break;
          case 6: // RGBA
            rgba[dstIdx] = curRow[x * 4];
            rgba[dstIdx + 1] = curRow[x * 4 + 1];
            rgba[dstIdx + 2] = curRow[x * 4 + 2];
            rgba[dstIdx + 3] = curRow[x * 4 + 3];
            break;
        }
      }

      prevRow.set(curRow);
    }

    return { width, height, data: rgba };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Minimal JPEG decoder — extracts pixel data from JPEG images
// Uses Node.js to decode via a simple approach
// ---------------------------------------------------------------------------

// For JPEG, we'll use a different approach: since we can't easily decode JPEG
// in pure JS without a library, we'll rely on the client-side approach for JPEG
// and only decode PNGs server-side. The client will generate and store the result.

// ---------------------------------------------------------------------------
// Image resize (nearest-neighbor, good enough for ASCII)
// ---------------------------------------------------------------------------

function resizeImageData(
  srcData: Uint8Array, srcW: number, srcH: number,
  dstW: number, dstH: number
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = Math.floor(x * xRatio);
      const sy = Math.floor(y * yRatio);
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = srcData[si];
      dst[di + 1] = srcData[si + 1];
      dst[di + 2] = srcData[si + 2];
      dst[di + 3] = srcData[si + 3];
    }
  }
  return dst;
}

// ---------------------------------------------------------------------------
// Generate ASCII from pixel data
// ---------------------------------------------------------------------------

interface AsciiResult {
  lines: string[];
  coloredLines: Array<Array<{ char: string; color: string }>>;
  cols: number;
  rows: number;
}

function pixelsToAscii(
  pixelData: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  cols: number,
  format: string
): AsciiResult {
  const ramp = RAMPS[format] || RAMPS.classic;
  const aspectFactor = format === "braille" ? 0.55 : 0.46;
  const rows = Math.max(1, Math.floor(cols * (imgHeight / imgWidth) * aspectFactor));

  // Resize to target dimensions
  const resized = resizeImageData(pixelData, imgWidth, imgHeight, cols, rows);

  const lines: string[] = [];
  const coloredLines: Array<Array<{ char: string; color: string }>> = [];

  for (let y = 0; y < rows; y++) {
    let line = "";
    const coloredLine: Array<{ char: string; color: string }> = [];

    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = resized[i];
      const g = resized[i + 1];
      const b = resized[i + 2];

      // Apply contrast/brightness adjustment similar to client-side
      const adjustedR = Math.min(255, Math.max(0, (r - 128) * 1.35 + 128 + 12));
      const adjustedG = Math.min(255, Math.max(0, (g - 128) * 1.35 + 128 + 12));
      const adjustedB = Math.min(255, Math.max(0, (b - 128) * 1.35 + 128 + 12));

      const lum = 0.299 * adjustedR + 0.587 * adjustedG + 0.114 * adjustedB;
      const charIndex = Math.floor((lum / 255) * (ramp.length - 1));
      const ch = ramp[charIndex];
      const color = lumToColor(lum);

      line += ch;
      coloredLine.push({ char: ch, color });
    }

    lines.push(line);
    coloredLines.push(coloredLine);
  }

  return { lines, coloredLines, cols, rows };
}

// ---------------------------------------------------------------------------
// Convex action: generate ASCII portrait from image URL
// ---------------------------------------------------------------------------

export const generatePortrait = action({
  args: {
    imageUrl: v.string(),
    cols: v.optional(v.number()),
    format: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const cols = args.cols ?? 120;
    const format = args.format ?? "classic";

    try {
      // Fetch the image
      const response = await fetch(args.imageUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to fetch image: ${response.status}` };
      }

      const contentType = response.headers.get("content-type") || "";
      const buffer = new Uint8Array(await response.arrayBuffer());

      let imageData: { width: number; height: number; data: Uint8Array } | null = null;

      if (contentType.includes("png") || args.imageUrl.toLowerCase().includes(".png")) {
        imageData = decodePNG(buffer);
      }

      // If PNG decode failed or it's not a PNG, try using JPEG decode approach
      // For now, return an indicator that client-side generation is needed
      if (!imageData) {
        return {
          success: false,
          error: "Server-side decode not supported for this image format. Client-side generation will be used.",
          needsClientSide: true,
        };
      }

      const result = pixelsToAscii(imageData.data, imageData.width, imageData.height, cols, format);

      return {
        success: true,
        portrait: {
          lines: result.lines,
          coloredLines: result.coloredLines,
          cols: result.cols,
          rows: result.rows,
          format,
          sourceUrl: args.imageUrl,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: `Portrait generation failed: ${message}` };
    }
  },
});
