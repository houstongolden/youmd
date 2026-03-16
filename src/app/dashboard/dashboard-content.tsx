"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface ProfileFormData {
  name: string;
  tagline: string;
  location: string;
  bioShort: string;
  bioMedium: string;
  bioLong: string;
  nowFocus: string;
  projects: string;
  values: string;
  linkWebsite: string;
  linkLinkedin: string;
  linkX: string;
  agentTone: string;
  agentAvoid: string;
  writingStyle: string;
}

function compileBundle(data: ProfileFormData, username: string) {
  const now = new Date().toISOString();

  const projects = data.projects
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((s) => s.trim());
      return {
        name: parts[0] || "",
        role: parts[1] || "",
        status: parts[2] || "active",
        url: parts[3] || "",
        description: parts[4] || "",
      };
    });

  const youJson = {
    schema: "you-md/v1",
    username,
    generated_at: now,
    identity: {
      name: data.name,
      tagline: data.tagline,
      location: data.location,
      bio: {
        short: data.bioShort,
        medium: data.bioMedium,
        long: data.bioLong,
      },
    },
    now: {
      focus: data.nowFocus.split("\n").filter(Boolean),
      updated_at: now.split("T")[0],
    },
    projects,
    values: data.values.split("\n").filter(Boolean),
    links: {
      website: data.linkWebsite || undefined,
      linkedin: data.linkLinkedin || undefined,
      x: data.linkX || undefined,
    },
    preferences: {
      agent: {
        tone: data.agentTone,
        avoid: data.agentAvoid.split(",").map((s) => s.trim()).filter(Boolean),
      },
      writing: {
        style: data.writingStyle,
        format: "markdown preferred",
      },
    },
    analysis: {
      topics: [],
      voice_summary: "",
      credibility_signals: [],
    },
    meta: {
      sources_used: [],
      last_updated: now,
      compiler_version: "0.1.0",
    },
    verification: null,
  };

  const youMd = `---
schema: you-md/v1
name: ${data.name}
username: ${username}
generated_at: ${now.split("T")[0]}
---

# ${data.name}

${data.tagline}

## Now

${data.nowFocus
    .split("\n")
    .filter(Boolean)
    .map((f) => `- ${f}`)
    .join("\n")}

## Projects

${projects.map((p) => `- **${p.name}** — ${p.description} (${p.role}, ${p.status})`).join("\n")}

## Values

${data.values
    .split("\n")
    .filter(Boolean)
    .map((v) => `- ${v}`)
    .join("\n")}

## Agent Preferences

Tone: ${data.agentTone}
Avoid: ${data.agentAvoid}
Format: ${data.writingStyle}

## Links

${data.linkWebsite ? `- Website: ${data.linkWebsite}` : ""}
${data.linkLinkedin ? `- LinkedIn: ${data.linkLinkedin}` : ""}
${data.linkX ? `- X: ${data.linkX}` : ""}

---

> Full context: see manifest.json
`;

  const manifest = {
    schema: "you-md/v1",
    username,
    generated_at: now,
    compiler_version: "0.1.0",
    paths: {
      public: ["you.md", "you.json"],
      private: [],
      scoped: [],
    },
    sources: {},
    update_policy: {
      auto_refresh: false,
      refresh_interval_days: null,
      require_approval: true,
    },
    custom_paths: [],
  };

  return { youJson, youMd, manifest };
}

export function DashboardContent() {
  const { user } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );
  const saveBundle = useMutation(api.bundles.saveBundle);
  const publishBundle = useMutation(api.bundles.publishBundle);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<ProfileFormData>({
    name: user?.fullName || "",
    tagline: "",
    location: "",
    bioShort: "",
    bioMedium: "",
    bioLong: "",
    nowFocus: "",
    projects: "",
    values: "",
    linkWebsite: "",
    linkLinkedin: "",
    linkX: "",
    agentTone: "",
    agentAvoid: "",
    writingStyle: "",
  });

  // Sync form state when latestBundle loads or changes
  const hydratedVersionRef = useRef<number | null>(null);
  useEffect(() => {
    const json = latestBundle?.youJson;
    if (!json) return;
    // Only hydrate once per bundle version to avoid overwriting user edits
    const bundleVersion = latestBundle?.version ?? 0;
    if (hydratedVersionRef.current === bundleVersion) return;
    hydratedVersionRef.current = bundleVersion;
    setForm({
      name: json.identity?.name || user?.fullName || "",
      tagline: json.identity?.tagline || "",
      location: json.identity?.location || "",
      bioShort: json.identity?.bio?.short || "",
      bioMedium: json.identity?.bio?.medium || "",
      bioLong: json.identity?.bio?.long || "",
      nowFocus: json.now?.focus?.join("\n") || "",
      projects: json.projects
        ?.map(
          (p: { name: string; role: string; status: string; url: string; description: string }) =>
            `${p.name}|${p.role}|${p.status}|${p.url}|${p.description}`
        )
        .join("\n") || "",
      values: json.values?.join("\n") || "",
      linkWebsite: json.links?.website || "",
      linkLinkedin: json.links?.linkedin || "",
      linkX: json.links?.x || "",
      agentTone: json.preferences?.agent?.tone || "",
      agentAvoid: json.preferences?.agent?.avoid?.join(", ") || "",
      writingStyle: json.preferences?.writing?.style || "",
    });
  }, [latestBundle, user?.fullName]);

  const updateField = (field: keyof ProfileFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (!convexUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground-secondary">Loading...</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { youJson, youMd, manifest } = compileBundle(
        form,
        convexUser.username
      );
      await saveBundle({
        userId: convexUser._id,
        manifest,
        youJson,
        youMd,
      });
      setMessage("Bundle saved.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to save bundle"
      );
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!latestBundle) return;
    setPublishing(true);
    setMessage(null);
    try {
      await publishBundle({ bundleId: latestBundle._id });
      setMessage(
        `Published! Live at you.md/${convexUser.username}`
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to publish"
      );
    }
    setPublishing(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-mono text-lg tracking-tight">
          you.md
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/${convexUser.username}`}
            className="text-sm font-mono text-sky hover:underline"
          >
            you.md/{convexUser.username}
          </Link>
          <SignOutButton>
            <button className="text-sm text-foreground-secondary hover:text-foreground transition-colors">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Status bar */}
        <div className="flex items-center gap-3 px-4 py-2 border border-border rounded-md bg-background-secondary text-xs font-mono text-foreground-secondary">
          <span className="text-mist">@{convexUser.username}</span>
          <span className="text-border">|</span>
          <span className={convexUser.plan === "pro" ? "text-gold" : "text-mist"}>
            {convexUser.plan}
          </span>
          <span className="text-border">|</span>
          <span>
            {latestBundle ? `v${latestBundle.version}` : "no bundle"}
          </span>
          <span className="text-border">|</span>
          <span className={latestBundle?.isPublished ? "text-sky" : "text-coral"}>
            {latestBundle?.isPublished ? "published" : "draft"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Edit your identity</h1>
          <div className="flex gap-2">
            <a
              href={`/${convexUser.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm border border-border rounded-md hover:border-sky transition-colors text-foreground-secondary hover:text-foreground"
            >
              Preview
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-background-secondary border border-border rounded-md hover:border-sky transition-colors disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !latestBundle}
              className="px-4 py-2 text-sm bg-coral text-void rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>

        {message && (
          <div className="px-4 py-2 text-sm border border-border rounded-md bg-background-secondary text-foreground-secondary">
            {message}
          </div>
        )}

        {/* Identity Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Identity
          </h2>
          <div className="grid gap-4">
            <Field
              label="Full name"
              value={form.name}
              onChange={(v) => updateField("name", v)}
            />
            <Field
              label="Tagline"
              value={form.tagline}
              onChange={(v) => updateField("tagline", v)}
              placeholder="Founder, BAMF Media. Building You.md."
            />
            <Field
              label="Location"
              value={form.location}
              onChange={(v) => updateField("location", v)}
              placeholder="Miami, FL"
            />
          </div>
        </section>

        {/* Bio Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Bio
          </h2>
          <div className="grid gap-4">
            <Field
              label="Short (1 line)"
              value={form.bioShort}
              onChange={(v) => updateField("bioShort", v)}
            />
            <TextArea
              label="Medium (3 lines)"
              value={form.bioMedium}
              onChange={(v) => updateField("bioMedium", v)}
              rows={3}
            />
            <TextArea
              label="Long (paragraph)"
              value={form.bioLong}
              onChange={(v) => updateField("bioLong", v)}
              rows={5}
            />
          </div>
        </section>

        {/* Now Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Now
          </h2>
          <TextArea
            label="Current focus (one per line)"
            value={form.nowFocus}
            onChange={(v) => updateField("nowFocus", v)}
            rows={4}
            placeholder="Building You.md&#10;Scaling BAMF Media"
          />
        </section>

        {/* Projects */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Projects
          </h2>
          <TextArea
            label="One per line: Name|Role|Status|URL|Description"
            value={form.projects}
            onChange={(v) => updateField("projects", v)}
            rows={4}
            placeholder="You.md|Founder|building|https://you.md|Identity as code for the agent internet"
          />
        </section>

        {/* Values */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Values
          </h2>
          <TextArea
            label="One per line"
            value={form.values}
            onChange={(v) => updateField("values", v)}
            rows={4}
            placeholder="Build in public&#10;Extreme ownership&#10;Ship fast"
          />
        </section>

        {/* Links */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Links
          </h2>
          <div className="grid gap-4">
            <Field
              label="Website"
              value={form.linkWebsite}
              onChange={(v) => updateField("linkWebsite", v)}
              placeholder="https://yoursite.com"
            />
            <Field
              label="LinkedIn"
              value={form.linkLinkedin}
              onChange={(v) => updateField("linkLinkedin", v)}
              placeholder="https://linkedin.com/in/yourname"
            />
            <Field
              label="X / Twitter"
              value={form.linkX}
              onChange={(v) => updateField("linkX", v)}
              placeholder="https://x.com/yourname"
            />
          </div>
        </section>

        {/* Agent Preferences */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
            Agent Preferences
          </h2>
          <div className="grid gap-4">
            <Field
              label="Tone"
              value={form.agentTone}
              onChange={(v) => updateField("agentTone", v)}
              placeholder="direct, confident, no fluff"
            />
            <Field
              label="Avoid (comma-separated)"
              value={form.agentAvoid}
              onChange={(v) => updateField("agentAvoid", v)}
              placeholder="corporate jargon, passive voice"
            />
            <Field
              label="Writing style"
              value={form.writingStyle}
              onChange={(v) => updateField("writingStyle", v)}
              placeholder="short paragraphs, punchy sentences"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-foreground-secondary mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded-md outline-none focus:border-sky transition-colors placeholder:text-mist/40"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-foreground-secondary mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded-md outline-none focus:border-sky transition-colors resize-y placeholder:text-mist/40 font-mono"
      />
    </div>
  );
}
