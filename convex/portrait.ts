"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import jpegJs from "jpeg-js";
import zlib from "zlib";
import {
  extractOgImageUrl,
  resolvePortraitSourceChain,
  type PortraitSourceCandidate,
} from "./pipeline/portraitSource";

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
// Shared decode helper — PNG (built-in) + JPEG (jpeg-js)
// ---------------------------------------------------------------------------

function decodeImage(
  buffer: Uint8Array,
  contentType: string,
  urlHint: string
): { width: number; height: number; data: Uint8Array } | null {
  let imageData: { width: number; height: number; data: Uint8Array } | null = null;

  if (contentType.includes("png") || urlHint.toLowerCase().includes(".png")) {
    imageData = decodePNG(buffer);
  }

  if (!imageData && (contentType.includes("jpeg") || contentType.includes("jpg"))) {
    try {
      const decoded = jpegJs.decode(Buffer.from(buffer), { useTArray: true });
      imageData = { width: decoded.width, height: decoded.height, data: decoded.data };
    } catch {
      // fall through — caller treats null as "decode unsupported"
    }
  }

  // Last resort: content-type was wrong/absent — sniff both formats.
  if (!imageData) imageData = decodePNG(buffer);
  if (!imageData) {
    try {
      const decoded = jpegJs.decode(Buffer.from(buffer), { useTArray: true });
      imageData = { width: decoded.width, height: decoded.height, data: decoded.data };
    } catch {
      // give up — caller handles null
    }
  }

  return imageData;
}

// ---------------------------------------------------------------------------
// Validated fetching for the portrait source chain (U17)
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;
const MIN_IMAGE_BYTES = 128; // anything smaller is a tracking pixel / error stub
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB cap — avatars are far smaller
const MAX_HTML_BYTES = 1024 * 1024; // 1MB of HTML is plenty to find og:image
const PORTRAIT_USER_AGENT = "You.md portrait-resolver/0.1 (+https://you.md)";

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": PORTRAIT_USER_AGENT },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch a candidate image URL and validate it before use:
 *   - HTTP 2xx
 *   - content-type is image/* (SVG excluded — we can't rasterize it)
 *   - payload between MIN_IMAGE_BYTES and MAX_IMAGE_BYTES
 * Returns null (with a reason) on any failure so the chain falls through.
 */
async function fetchValidatedImage(
  url: string
): Promise<
  | { ok: true; buffer: Uint8Array; contentType: string }
  | { ok: false; reason: string }
> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      return { ok: false, reason: `not_image_content_type:${contentType || "missing"}` };
    }
    if (contentType.includes("svg")) {
      return { ok: false, reason: "svg_not_rasterizable" };
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_IMAGE_BYTES) {
      return { ok: false, reason: `too_large_declared:${declaredLength}` };
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength < MIN_IMAGE_BYTES) {
      return { ok: false, reason: `too_small:${buffer.byteLength}` };
    }
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, reason: `too_large:${buffer.byteLength}` };
    }

    return { ok: true, buffer, contentType };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, reason: message };
  }
}

/**
 * Fetch a website's HTML (validated: 2xx + text/html + size cap) and extract
 * its og:image URL. Returns null on any failure.
 */
async function fetchOgImageUrl(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(websiteUrl);
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer()).slice(0, MAX_HTML_BYTES);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return extractOgImageUrl(html, response.url || websiteUrl);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Convex action: generate ASCII portrait from image URL
// ---------------------------------------------------------------------------

/**
 * Cycle 59: converted from `action` (public) to `internalAction`. Has ZERO
 * callers in src/, convex/, or cli/ — it was dead code that nonetheless
 * exposed an anonymous SSRF vector: `args.imageUrl` is a user-provided
 * string with no validation, then fetched directly. An attacker could:
 *   1. Pass internal URLs (http://<convex-internal>/ ...) — server-side
 *      request forgery
 *   2. Spam expensive image fetches (no rate limit, no payload size cap)
 *   3. Fetch huge payloads to OOM the function (no content-length check)
 *
 * The cycle 40 audit incorrectly claimed all portrait actions were "called
 * from mutations/queries that already auth-check". That was wrong — this
 * one had no callers at all.
 *
 * Now `internalAction`, so it cannot be reached via /api/action. If Houston
 * later wants a server-side portrait generator, the function body is preserved
 * — just convert back to `action` AND add: auth gate, rate limit, payload
 * size cap, allowlist of trusted image hosts, and content-type check.
 */
export const generatePortrait = internalAction({
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

      const imageData = decodeImage(buffer, contentType, args.imageUrl);

      if (!imageData) {
        return {
          success: false,
          error: "Server-side decode not supported for this image format.",
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

// ---------------------------------------------------------------------------
// U17 — generatePortraitForProfile: walk the portrait source chain
// ---------------------------------------------------------------------------

/**
 * Resolve a source image for a profile via the ordered chain
 * (explicit avatarUrl → social images → unavatar x → github → unavatar
 * linkedin → website og:image), validate each candidate, generate the ASCII
 * portrait from the first one that works, and save it.
 *
 * Guards (never overwrites a real portrait):
 *   - exits early when the profile already has a renderable portrait
 *   - savePortraitIfMissing re-checks at write time (race-safe)
 *
 * Scheduled from the pipeline orchestrator after the compile/review stage so
 * profiles that had no portrait at onboarding get a retry once research has
 * discovered their social links/handles. internalAction only — args are
 * trusted (no SSRF surface beyond URLs derived from the profile's own links).
 */
export const generatePortraitForProfile = internalAction({
  args: {
    username: v.string(),
    cols: v.optional(v.number()),
    format: v.optional(v.string()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<
    | { success: true; source: string; sourceUrl: string }
    | { success: false; reason: string; attempted: string[] }
  > => {
    const cols = args.cols ?? 120;
    const format = args.format ?? "classic";

    const context = await ctx.runMutation(
      internal.pipeline.mutations.getPortraitContext,
      { username: args.username }
    );

    if (!context) {
      console.log(`[portrait] ${args.username}: no profile found — skipping`);
      return { success: false, reason: "profile_not_found", attempted: [] };
    }

    if (context.hasPortrait && !args.force) {
      console.log(`[portrait] ${context.username}: portrait already exists — not overwriting`);
      return { success: false, reason: "portrait_exists", attempted: [] };
    }

    const chain = resolvePortraitSourceChain({
      avatarUrl: context.avatarUrl,
      socialImages: context.socialImages,
      primaryImage: context.primaryImage,
      links: context.links,
      youJsonLinks: context.youJsonLinks,
    });

    if (chain.length === 0) {
      console.log(`[portrait] ${context.username}: no source candidates — keeping default (no portrait)`);
      return { success: false, reason: "no_candidates", attempted: [] };
    }

    const attempted: string[] = [];

    for (const candidate of chain) {
      attempted.push(candidate.source);

      const imageUrl = await resolveCandidateImageUrl(candidate, context.username);
      if (!imageUrl) continue;

      const fetched = await fetchValidatedImage(imageUrl);
      if (!fetched.ok) {
        console.log(
          `[portrait] ${context.username}: ${candidate.source} failed validation (${fetched.reason}) — falling through`
        );
        continue;
      }

      const imageData = decodeImage(fetched.buffer, fetched.contentType, imageUrl);
      if (!imageData) {
        console.log(
          `[portrait] ${context.username}: ${candidate.source} decode unsupported (${fetched.contentType}) — falling through`
        );
        continue;
      }

      const ascii = pixelsToAscii(imageData.data, imageData.width, imageData.height, cols, format);

      const saveResult = await ctx.runMutation(
        internal.pipeline.mutations.savePortraitIfMissing,
        {
          profileId: context.profileId,
          portrait: {
            lines: ascii.lines,
            coloredLines: ascii.coloredLines,
            cols: ascii.cols,
            rows: ascii.rows,
            format,
            sourceUrl: imageUrl,
          },
          force: args.force,
        }
      );

      if (!saveResult.saved) {
        console.log(
          `[portrait] ${context.username}: generated from ${candidate.source} but not saved (${saveResult.reason})`
        );
        return { success: false, reason: saveResult.reason, attempted };
      }

      console.log(`[portrait] ${context.username}: portrait generated from ${candidate.source} (${imageUrl})`);
      return { success: true, source: candidate.source, sourceUrl: imageUrl };
    }

    console.log(
      `[portrait] ${context.username}: all ${chain.length} source candidates failed — keeping default (no portrait)`
    );
    return { success: false, reason: "all_candidates_failed", attempted };
  },
});

/** Turn a chain candidate into a concrete image URL (scraping og:image when needed). */
async function resolveCandidateImageUrl(
  candidate: PortraitSourceCandidate,
  username: string
): Promise<string | null> {
  if (candidate.type === "image") return candidate.url;

  const ogImage = await fetchOgImageUrl(candidate.url);
  if (!ogImage) {
    console.log(
      `[portrait] ${username}: ${candidate.source} found no og:image at ${candidate.url} — falling through`
    );
    return null;
  }
  return ogImage;
}
