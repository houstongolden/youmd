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
  const saveBundleFromForm = useMutation(api.me.saveBundleFromForm);
  const publishLatest = useMutation(api.me.publishLatest);

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
    if (!user?.id) return;
    setSaving(true);
    setMessage(null);
    try {
      const projects = form.projects
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

      const result = await saveBundleFromForm({
        clerkId: user.id,
        profileData: {
          name: form.name,
          username: convexUser.username,
          tagline: form.tagline,
          location: form.location,
          bio: {
            short: form.bioShort,
            medium: form.bioMedium,
            long: form.bioLong,
          },
          now: form.nowFocus.split("\n").filter(Boolean),
          projects,
          values: form.values.split("\n").filter(Boolean),
          links: {
            website: form.linkWebsite || undefined,
            linkedin: form.linkLinkedin || undefined,
            x: form.linkX || undefined,
          },
          preferences: {
            agent: {
              tone: form.agentTone,
              avoid: form.agentAvoid.split(",").map((s) => s.trim()).filter(Boolean),
            },
            writing: {
              style: form.writingStyle,
              format: "markdown preferred",
            },
          },
        },
      });
      setMessage(`Bundle saved (v${result.version}).`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to save bundle"
      );
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!user?.id || !latestBundle) return;
    setPublishing(true);
    setMessage(null);
    try {
      const result = await publishLatest({ clerkId: user.id });
      setMessage(
        `Published v${result.version}! Live at you.md/${result.username}`
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

        <hr className="border-border" />

        {/* API Keys Section */}
        <ApiKeysSection clerkId={user?.id ?? ""} />

        {/* Context Links Section */}
        <ContextLinksSection clerkId={user?.id ?? ""} username={convexUser.username} />
      </main>
    </div>
  );
}

function ApiKeysSection({ clerkId }: { clerkId: string }) {
  const keys = useQuery(api.apiKeys.listKeys, clerkId ? { clerkId } : "skip");
  const createKey = useMutation(api.apiKeys.createKey);
  const revokeKey = useMutation(api.apiKeys.revokeKey);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createKey({
        clerkId,
        label: "CLI key",
        scopes: ["read:public"],
      });
      setNewKey(result.key);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create key");
    }
    setCreating(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
          API Keys
        </h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="text-xs px-3 py-1.5 bg-background-secondary border border-border rounded-md hover:border-sky transition-colors disabled:opacity-40"
        >
          {creating ? "Creating..." : "Create key"}
        </button>
      </div>

      {newKey && (
        <div className="p-3 border border-gold/30 rounded-md bg-gold/5 space-y-2">
          <p className="text-xs text-gold font-medium">
            Key created. Copy it now — it won&apos;t be shown again.
          </p>
          <code className="block text-xs font-mono text-foreground bg-background-secondary p-2 rounded break-all select-all">
            {newKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKey);
              setNewKey(null);
            }}
            className="text-xs text-sky hover:underline"
          >
            Copy and dismiss
          </button>
        </div>
      )}

      {keys && keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between px-3 py-2 border border-border rounded-md bg-background-secondary text-xs"
            >
              <div className="space-y-0.5">
                <span className="font-mono text-foreground-secondary">
                  {k.keyPrefix}
                </span>
                {k.label && (
                  <span className="text-mist ml-2">{k.label}</span>
                )}
                <div className="text-mist">
                  {k.scopes.join(", ")}
                  {k.lastUsedAt && ` · last used ${k.lastUsedAt.split("T")[0]}`}
                </div>
              </div>
              {!k.isRevoked && (
                <button
                  onClick={() => revokeKey({ clerkId, keyId: k.id })}
                  className="text-coral hover:underline"
                >
                  Revoke
                </button>
              )}
              {k.isRevoked && (
                <span className="text-mist">revoked</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-mist">No API keys yet. Create one to use the CLI.</p>
      )}
    </section>
  );
}

function ContextLinksSection({
  clerkId,
  username,
}: {
  clerkId: string;
  username: string;
}) {
  const links = useQuery(
    api.contextLinks.listLinks,
    clerkId ? { clerkId } : "skip"
  );
  const createLink = useMutation(api.contextLinks.createLink);
  const revokeLink = useMutation(api.contextLinks.revokeLink);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createLink({
        clerkId,
        scope: "public",
        ttl: "7d",
      });
      setNewLink(result.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create link");
    }
    setCreating(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
          Context Links
        </h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="text-xs px-3 py-1.5 bg-background-secondary border border-border rounded-md hover:border-sky transition-colors disabled:opacity-40"
        >
          {creating ? "Creating..." : "Create link"}
        </button>
      </div>

      <p className="text-xs text-mist">
        Context links let you share your identity bundle with any AI agent.
        Paste the link into any conversation.
      </p>

      {newLink && (
        <div className="p-3 border border-sky/30 rounded-md bg-sky/5 space-y-2">
          <p className="text-xs text-sky font-medium">
            Context link created (expires in 7 days):
          </p>
          <code className="block text-xs font-mono text-foreground bg-background-secondary p-2 rounded break-all select-all">
            {newLink}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newLink);
              setNewLink(null);
            }}
            className="text-xs text-sky hover:underline"
          >
            Copy and dismiss
          </button>
        </div>
      )}

      {links && links.length > 0 ? (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className={`flex items-center justify-between px-3 py-2 border border-border rounded-md bg-background-secondary text-xs ${
                link.isExpired ? "opacity-50" : ""
              }`}
            >
              <div className="space-y-0.5">
                <span className="font-mono text-sky">
                  /ctx/{username}/{link.token.slice(0, 8)}...
                </span>
                <div className="text-mist">
                  {link.scope} · {link.useCount} uses ·{" "}
                  {link.isExpired
                    ? "expired"
                    : `expires ${typeof link.expiresAt === "string" ? link.expiresAt.split("T")[0] : "never"}`}
                </div>
              </div>
              {!link.isExpired && (
                <button
                  onClick={() => revokeLink({ clerkId, linkId: link.id })}
                  className="text-coral hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-mist">
          No context links yet. Create one to share your identity with agents.
        </p>
      )}
    </section>
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
