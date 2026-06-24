/**
 * Monotonic, sortable request-id generator for cross-machine commands
 * (CROSS-MACHINE-AGENTS.md §3/§6). ULID-shaped: `rc_<48-bit-time><random>`.
 *
 * Properties:
 *   - lexicographically sortable by creation time (time prefix is fixed-width)
 *   - collision-resistant within a process (per-ms monotonic counter) and
 *     across processes (CSPRNG suffix)
 *   - no Math.random / Date.now correctness footguns: the counter guarantees
 *     uniqueness even if two ids are minted in the same millisecond, and the
 *     random suffix uses crypto.randomBytes.
 */

import { randomBytes } from "crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeBase32(value: number, length: number): string {
  let out = "";
  let n = value;
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

function randomBase32(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CROCKFORD[bytes[i] % 32];
  }
  return out;
}

let lastTime = 0;
let counter = 0;

/** Generate a sortable, collision-resistant request id, prefixed `rc_`. */
export function generateRequestId(): string {
  let now = Date.now();
  if (now === lastTime) {
    counter += 1;
  } else {
    lastTime = now;
    counter = 0;
  }
  // 10-char base32 time component (48-bit ms timestamp, ULID-style).
  const time = encodeBase32(now, 10);
  // 3-char monotonic counter + 8-char CSPRNG suffix.
  const seq = encodeBase32(counter % (32 * 32 * 32), 3);
  const rand = randomBase32(8);
  return `rc_${time}${seq}${rand}`;
}
