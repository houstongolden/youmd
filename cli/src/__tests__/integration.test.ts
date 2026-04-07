import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { compileBundle, writeBundle } from "../lib/compiler";
import { computeContentHash } from "../lib/hash";

describe("integration: bundle round-trip", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-integration-"));
    // Create a realistic bundle structure
    for (const dir of ["profile", "preferences", "voice", "directives"]) {
      fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("full compile → write → re-read produces consistent hash", () => {
    // Write realistic profile data
    fs.writeFileSync(path.join(tmpDir, "profile", "about.md"), `---
title: About
---
# Test User

**Tagline:** Building something cool

**Location:** Austin, TX

Serial entrepreneur and developer. Building dev tools.`);

    fs.writeFileSync(path.join(tmpDir, "profile", "projects.md"), `---
title: Projects
---
## Project Alpha
- **Role:** Founder
- **Status:** building
- **Description:** An amazing project.
- **URL:** https://alpha.dev

## Project Beta
- **Role:** Contributor
- **Status:** active
- **Description:** Open source contribution.`);

    fs.writeFileSync(path.join(tmpDir, "profile", "values.md"), `---
title: Values
---
- Ship fast
- Build in public
- Help others grow`);

    fs.writeFileSync(path.join(tmpDir, "preferences", "agent.md"), `---
title: Agent Preferences
---
**Tone:** direct, no fluff
**Formality:** casual-professional
**Avoid:** corporate speak, emoji, verbose explanations`);

    fs.writeFileSync(path.join(tmpDir, "voice", "voice.md"), `---
title: Voice
---
Direct, builder energy. Short sentences. Technical but approachable.`);

    // Compile
    const result = compileBundle(tmpDir);

    // Verify structure
    expect(result.youJson.schema).toBe("you-md/v1");
    expect(result.youJson.identity).toBeDefined();
    expect((result.youJson.identity as Record<string, unknown>).name).toBe("Test User");
    expect(result.youJson.projects).toBeDefined();
    expect((result.youJson.projects as unknown[]).length).toBe(2);
    expect(result.youJson.values).toBeDefined();
    expect(result.youJson.preferences).toBeDefined();

    // Verify markdown output
    expect(result.markdown).toContain("Test User");
    expect(result.markdown).toContain("you-md/v1");

    // Write to disk
    writeBundle(tmpDir, result);

    // Verify files exist
    expect(fs.existsSync(path.join(tmpDir, "you.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "you.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "manifest.json"))).toBe(true);

    // Re-read and verify JSON round-trip
    const reReadJson = JSON.parse(fs.readFileSync(path.join(tmpDir, "you.json"), "utf-8"));
    expect(reReadJson.schema).toBe("you-md/v1");
    expect(reReadJson.identity.name).toBe("Test User");

    // Verify hash is deterministic
    const hash1 = computeContentHash(result.youJson, result.markdown);
    const hash2 = computeContentHash(reReadJson, fs.readFileSync(path.join(tmpDir, "you.md"), "utf-8"));
    expect(hash1).toBe(hash2);
  });

  it("compile → decompile → recompile produces equivalent bundle", async () => {
    // Write a profile
    fs.writeFileSync(path.join(tmpDir, "profile", "about.md"), `---
title: About
---
# Round Trip Test

**Tagline:** Testing round trips

**Location:** Nowhere

A test bio.`);

    fs.writeFileSync(path.join(tmpDir, "profile", "values.md"), `- Value One\n- Value Two`);

    // Compile first
    const first = compileBundle(tmpDir);
    writeBundle(tmpDir, first);

    // Decompile (simulated: read you.json, write back to files)
    const { decompileToFilesystem } = await import("../lib/decompile");
    const youJson = JSON.parse(fs.readFileSync(path.join(tmpDir, "you.json"), "utf-8"));

    // Create a fresh dir for decompilation
    const decompDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-decomp-"));
    for (const dir of ["profile", "preferences", "voice", "directives"]) {
      fs.mkdirSync(path.join(decompDir, dir), { recursive: true });
    }

    decompileToFilesystem(decompDir, youJson);

    // Verify decompiled files exist
    expect(fs.existsSync(path.join(decompDir, "profile", "about.md"))).toBe(true);

    // Recompile from decompiled
    const second = compileBundle(decompDir);

    // Core identity should survive round-trip
    const id1 = (first.youJson.identity as Record<string, unknown>);
    const id2 = (second.youJson.identity as Record<string, unknown>);
    expect(id2.name).toBe(id1.name);

    // Clean up
    fs.rmSync(decompDir, { recursive: true, force: true });
  });
});

describe("integration: vault encryption round-trip", () => {
  it("encrypt → decrypt produces original data", async () => {
    const { generateVaultKey, encryptData, decryptData } = await import("../lib/vault");

    const vaultKey = generateVaultKey();
    const original = "this is my private vault data with sensitive info";

    const { ciphertext, iv } = encryptData(original, vaultKey);
    const decrypted = decryptData(ciphertext, iv, vaultKey);

    expect(decrypted).toBe(original);
  });

  it("vault key wrap → unwrap produces original key", async () => {
    const { generateVaultKey, encryptVaultKey, decryptVaultKey } = await import("../lib/vault");

    const vaultKey = generateVaultKey();
    const passphrase = "my-secret-passphrase-123";

    const wrapped = encryptVaultKey(vaultKey, passphrase);
    const unwrapped = decryptVaultKey(wrapped.encrypted, passphrase, wrapped.salt, wrapped.iv);

    expect(Buffer.from(unwrapped).equals(Buffer.from(vaultKey))).toBe(true);
  });

  it("wrong passphrase fails to decrypt", async () => {
    const { generateVaultKey, encryptVaultKey, decryptVaultKey } = await import("../lib/vault");

    const vaultKey = generateVaultKey();
    const wrapped = encryptVaultKey(vaultKey, "correct-password");

    expect(() => {
      decryptVaultKey(wrapped.encrypted, "wrong-password", wrapped.salt, wrapped.iv);
    }).toThrow();
  });

  it("handles unicode and long text", async () => {
    const { generateVaultKey, encryptData, decryptData } = await import("../lib/vault");

    const vaultKey = generateVaultKey();
    const original = "Unicode test: Hello World\n" + "A".repeat(10000);

    const { ciphertext, iv } = encryptData(original, vaultKey);
    const decrypted = decryptData(ciphertext, iv, vaultKey);

    expect(decrypted).toBe(original);
  });
});

describe("integration: API endpoint contract", () => {
  it("profile endpoint returns you-md/v1 schema", async () => {
    const res = await fetch(
      "https://kindly-cassowary-600.convex.site/api/v1/profiles?username=houstongolden",
      { signal: AbortSignal.timeout(10_000) }
    );
    expect(res.ok).toBe(true);

    const data = await res.json() as Record<string, unknown>;
    expect(data.schema).toBe("you-md/v1");
    expect(data.identity).toBeDefined();
    expect(data.preferences).toBeDefined();
  });

  it("profile text endpoint returns markdown with frontmatter", async () => {
    const res = await fetch(
      "https://kindly-cassowary-600.convex.site/api/v1/profiles?username=houstongolden",
      {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(10_000),
      }
    );
    expect(res.ok).toBe(true);

    const text = await res.text();
    expect(text).toContain("schema: you-md/v1");
    expect(text).toContain("Houston Golden");
  });

  it("profile list returns array of profiles", async () => {
    const res = await fetch(
      "https://kindly-cassowary-600.convex.site/api/v1/profiles",
      { signal: AbortSignal.timeout(10_000) }
    );
    expect(res.ok).toBe(true);

    const data = await res.json() as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("auth endpoints properly gate without token", async () => {
    const res = await fetch(
      "https://kindly-cassowary-600.convex.site/api/v1/me",
      { signal: AbortSignal.timeout(10_000) }
    );
    expect(res.status).toBe(401);
  });

  it("skills registry returns published skills", async () => {
    const res = await fetch(
      "https://kindly-cassowary-600.convex.site/api/v1/skills",
      { signal: AbortSignal.timeout(10_000) }
    );
    expect(res.ok).toBe(true);

    const data = await res.json() as Record<string, unknown>;
    const skills = data.skills as unknown[];
    expect(skills.length).toBeGreaterThanOrEqual(4);
  });

  it("CORS headers present on OPTIONS", async () => {
    const res = await fetch(
      "https://kindly-cassowary-600.convex.site/api/v1/profiles",
      {
        method: "OPTIONS",
        signal: AbortSignal.timeout(10_000),
      }
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("sample profiles have full identity data", async () => {
    for (const username of ["priya", "jmarcus", "emmawright"]) {
      const res = await fetch(
        `https://kindly-cassowary-600.convex.site/api/v1/profiles?username=${username}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      expect(res.ok).toBe(true);

      const data = await res.json() as Record<string, unknown>;
      const identity = data.identity as Record<string, unknown>;
      expect(identity).toBeDefined();
      expect(identity.name).toBeDefined();
      expect(data.projects).toBeDefined();
    }
  });
});
