"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { CopyButton } from "@/components/ui/CopyButton";

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

type Tab = "profile" | "sources" | "settings";

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
  const [activeTab, setActiveTab] = useState<Tab>("profile");

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

  // Auto-dismiss status messages after 5 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  // Sync form state when latestBundle loads or changes
  const hydratedVersionRef = useRef<number | null>(null);
  useEffect(() => {
    const json = latestBundle?.youJson;
    if (!json) return;
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
      <div className="min-h-screen flex items-center justify-center bg-background">
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

  const profileUrl = `https://you.md/${convexUser.username}`;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-lg tracking-tight text-foreground">
            you.md
          </Link>
          <Link
            href="/"
            className="text-xs text-foreground-secondary hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/${convexUser.username}`}
            className="text-sm font-mono text-accent-secondary hover:underline"
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
        {/* Published profile URL */}
        <div className="px-5 py-4 border border-border rounded-lg bg-background-secondary">
          <p className="text-xs text-foreground-secondary mb-1.5">Your published profile</p>
          <div className="flex items-center gap-3">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-accent-secondary hover:underline text-sm"
            >
              {profileUrl}
            </a>
            <CopyButton text={profileUrl} />
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg bg-background-secondary text-xs font-mono text-foreground-secondary">
          <span className="text-foreground">@{convexUser.username}</span>
          <span className="text-border">|</span>
          <span className={convexUser.plan === "pro" ? "text-accent-premium" : "text-foreground-secondary"}>
            {convexUser.plan}
          </span>
          <span className="text-border">|</span>
          <span>
            {latestBundle ? `v${latestBundle.version}` : "no bundle"}
          </span>
          <span className="text-border">|</span>
          <span className={latestBundle?.isPublished ? "text-accent-secondary" : "text-accent-primary"}>
            {latestBundle?.isPublished ? "published" : "draft"}
          </span>
          {latestBundle && (
            <>
              <span className="text-border">|</span>
              <span>
                updated {new Date(latestBundle._creationTime).toLocaleDateString()}
              </span>
            </>
          )}
        </div>

        {/* Chat with agent */}
        <Link
          href="/dashboard/chat"
          className="flex items-center justify-between px-5 py-4 border border-border rounded-lg bg-background-secondary hover:border-accent-secondary transition-colors group"
        >
          <div>
            <p className="text-sm font-medium text-foreground group-hover:text-accent-secondary transition-colors">
              Chat with agent
            </p>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Build and refine your identity through conversation
            </p>
          </div>
          <span className="text-foreground-secondary group-hover:text-accent-secondary transition-colors">
            &rarr;
          </span>
        </Link>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Edit your identity</h1>
          <div className="flex gap-2">
            <a
              href={`/${convexUser.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm border border-border rounded-lg hover:border-accent-secondary transition-colors text-foreground-secondary hover:text-foreground"
            >
              Preview
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-background-secondary border border-border rounded-lg hover:border-accent-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-foreground inline-flex items-center gap-2"
            >
              {saving && <Spinner size="sm" />}
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !latestBundle}
              className="px-4 py-2 text-sm bg-accent-primary text-void rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {publishing && <Spinner size="sm" />}
              {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>

        {message && (
          <div className="px-4 py-2.5 text-sm border border-border rounded-lg bg-background-secondary text-foreground-secondary">
            {message}
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-border">
          {(["profile", "sources", "settings"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-accent-primary text-foreground"
                  : "border-transparent text-foreground-secondary hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === "profile" && (
          <div className="space-y-8">
            <CollapsibleSection title="Identity" defaultOpen>
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
            </CollapsibleSection>

            <CollapsibleSection title="Bio" defaultOpen>
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
            </CollapsibleSection>

            <CollapsibleSection title="Now">
              <TextArea
                label="Current focus (one per line)"
                value={form.nowFocus}
                onChange={(v) => updateField("nowFocus", v)}
                rows={4}
                placeholder="Building You.md&#10;Scaling BAMF Media"
              />
            </CollapsibleSection>

            <CollapsibleSection title="Projects">
              <TextArea
                label="One per line: Name|Role|Status|URL|Description"
                value={form.projects}
                onChange={(v) => updateField("projects", v)}
                rows={4}
                placeholder="You.md|Founder|building|https://you.md|Identity as code for the agent internet"
              />
            </CollapsibleSection>

            <CollapsibleSection title="Values">
              <TextArea
                label="One per line"
                value={form.values}
                onChange={(v) => updateField("values", v)}
                rows={4}
                placeholder="Build in public&#10;Extreme ownership&#10;Ship fast"
              />
            </CollapsibleSection>

            <CollapsibleSection title="Links">
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
            </CollapsibleSection>

            <CollapsibleSection title="Agent Preferences">
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
            </CollapsibleSection>

            {/* View you.json */}
            <CollapsibleSection title="View your you.json">
              {latestBundle?.youJson ? (
                <div className="relative">
                  <pre className="text-xs font-mono text-foreground-secondary bg-background-secondary border border-border rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(latestBundle.youJson, null, 2)}
                  </pre>
                  <CopyButton
                    text={JSON.stringify(latestBundle.youJson, null, 2)}
                    className="absolute top-3 right-3 text-xs px-2.5 py-1 border border-border rounded-md bg-background text-foreground-secondary hover:text-foreground hover:border-accent-secondary transition-colors"
                  />
                </div>
              ) : (
                <p className="text-sm text-foreground-secondary">
                  No bundle yet. Save your profile to generate one.
                </p>
              )}
            </CollapsibleSection>
          </div>
        )}

        {/* Sources tab */}
        {activeTab === "sources" && (
          <div className="space-y-8">
            <SourceManagementSection clerkId={user?.id ?? ""} />
          </div>
        )}

        {/* Settings tab */}
        {activeTab === "settings" && (
          <div className="space-y-8">
            <ApiKeysSection clerkId={user?.id ?? ""} />
            <hr className="border-border" />
            <ContextLinksSection clerkId={user?.id ?? ""} username={convexUser.username} />
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Management
// ---------------------------------------------------------------------------

function SourceManagementSection({ clerkId }: { clerkId: string }) {
  const sources = useQuery(api.me.getSources, clerkId ? { clerkId } : "skip");
  const addSource = useMutation(api.me.addSource);
  const startPipeline = useMutation(api.pipeline.index.startPipeline);
  const pipelineStatus = useQuery(
    api.pipeline.index.getPipelineStatus,
    clerkId ? { clerkId } : "skip"
  );

  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<"website" | "linkedin" | "x">("website");
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAddSource = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    setStatusMessage(null);
    try {
      await addSource({ clerkId, sourceType: newType, sourceUrl: newUrl.trim() });
      setNewUrl("");
      setStatusMessage("Source added.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to add source");
    }
    setAdding(false);
  };

  const handleBuild = async () => {
    setBuilding(true);
    setStatusMessage(null);
    try {
      const result = await startPipeline({ clerkId });
      setStatusMessage(`Pipeline started. Processing ${result.sourceCount} source(s).`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to start pipeline");
    }
    setBuilding(false);
  };

  const isRunning = pipelineStatus?.overallStatus === "running";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider mb-1">
          Sources
        </h2>
        <p className="text-xs text-foreground-secondary">
          Add your web presence URLs. The pipeline will fetch, extract, and compile your identity from these sources.
        </p>
      </div>

      {/* Add source form */}
      <div className="flex gap-2">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as "website" | "linkedin" | "x")}
          className="px-3 py-2 text-sm bg-background-secondary border border-border rounded-lg outline-none focus:border-accent-secondary transition-colors text-foreground"
        >
          <option value="website">Website</option>
          <option value="linkedin">LinkedIn</option>
          <option value="x">X / Twitter</option>
        </select>
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 px-3 py-2 text-sm bg-background-secondary border border-border rounded-lg outline-none focus:border-accent-secondary focus:shadow-[0_0_12px_rgba(122,190,208,0.15)] transition-all text-foreground placeholder:text-mist/40"
        />
        <button
          onClick={handleAddSource}
          disabled={adding || !newUrl.trim()}
          className="px-4 py-2 text-sm bg-background-secondary border border-border rounded-lg hover:border-accent-secondary transition-colors disabled:opacity-40 text-foreground"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>

      {/* Current sources */}
      {sources && sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source._id}
              className="flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-background-secondary text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-background border border-border text-foreground-secondary uppercase">
                    {source.sourceType}
                  </span>
                  <span className={`text-xs font-mono ${
                    source.status === "extracted" ? "text-success" :
                    source.status === "failed" ? "text-accent-primary" :
                    source.status === "fetched" ? "text-accent-secondary" :
                    "text-foreground-secondary"
                  }`}>
                    {source.status}
                  </span>
                </div>
                <p className="text-xs font-mono text-foreground-secondary mt-1 truncate">
                  {source.sourceUrl}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {sources && sources.length === 0 && (
        <p className="text-sm text-foreground-secondary">
          No sources yet. Add a URL above to get started.
        </p>
      )}

      {/* Pipeline status */}
      {pipelineStatus && pipelineStatus.overallStatus !== "idle" && (
        <div className={`px-4 py-3 border rounded-lg text-sm font-mono ${
          pipelineStatus.overallStatus === "running"
            ? "border-accent-secondary/30 bg-accent-secondary/5 text-accent-secondary"
            : pipelineStatus.overallStatus === "completed" || pipelineStatus.overallStatus === "review"
              ? "border-success/30 bg-success/5 text-success"
              : pipelineStatus.overallStatus === "failed"
                ? "border-accent-primary/30 bg-accent-primary/5 text-accent-primary"
                : "border-border"
        }`}>
          <div className="flex items-center gap-2">
            <span className="capitalize">{pipelineStatus.overallStatus}</span>
            {pipelineStatus.currentStage && (
              <span className="text-foreground-secondary">
                -- stage: {pipelineStatus.currentStage}
              </span>
            )}
          </div>
        </div>
      )}

      {statusMessage && (
        <p className="text-xs text-foreground-secondary">{statusMessage}</p>
      )}

      {/* Trigger Build */}
      <button
        onClick={handleBuild}
        disabled={building || isRunning || !sources || sources.length === 0}
        className="w-full py-3 bg-accent-primary text-void rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isRunning
          ? "Pipeline running..."
          : building
            ? "Starting..."
            : "Trigger Build"}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

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
          className="text-xs px-3 py-1.5 bg-background-secondary border border-border rounded-lg hover:border-accent-secondary transition-colors disabled:opacity-40 text-foreground"
        >
          {creating ? "Creating..." : "Create key"}
        </button>
      </div>

      {newKey && (
        <div className="p-4 border border-accent-premium/30 rounded-lg bg-accent-premium/5 space-y-2">
          <p className="text-xs text-accent-premium font-medium">
            Key created. Copy it now -- it will not be shown again.
          </p>
          <code className="block text-xs font-mono text-foreground bg-background-secondary p-2.5 rounded-lg break-all select-all">
            {newKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKey);
              setNewKey(null);
            }}
            className="text-xs text-accent-secondary hover:underline"
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
              className="flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-background-secondary text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-foreground px-2 py-0.5 bg-background rounded border border-border">
                    {k.keyPrefix}...
                  </code>
                  {k.label && (
                    <span className="text-foreground-secondary">{k.label}</span>
                  )}
                </div>
                <div className="text-foreground-secondary">
                  {k.scopes.join(", ")}
                  {k.lastUsedAt && ` -- last used ${k.lastUsedAt.split("T")[0]}`}
                </div>
              </div>
              {!k.isRevoked && (
                <button
                  onClick={() => revokeKey({ clerkId, keyId: k.id })}
                  className="text-accent-primary hover:underline"
                >
                  Revoke
                </button>
              )}
              {k.isRevoked && (
                <span className="text-foreground-secondary">revoked</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-foreground-secondary">No API keys yet. Create one to use the CLI.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Context Links
// ---------------------------------------------------------------------------

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
          className="text-xs px-3 py-1.5 bg-background-secondary border border-border rounded-lg hover:border-accent-secondary transition-colors disabled:opacity-40 text-foreground"
        >
          {creating ? "Creating..." : "Create link"}
        </button>
      </div>

      <p className="text-xs text-foreground-secondary">
        Context links let you share your identity bundle with any AI agent.
        Paste the link into any conversation.
      </p>

      {newLink && (
        <div className="p-4 border border-accent-secondary/30 rounded-lg bg-accent-secondary/5 space-y-2">
          <p className="text-xs text-accent-secondary font-medium">
            Context link created (expires in 7 days):
          </p>
          <code className="block text-xs font-mono text-foreground bg-background-secondary p-2.5 rounded-lg break-all select-all">
            {newLink}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newLink);
              setNewLink(null);
            }}
            className="text-xs text-accent-secondary hover:underline"
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
              className={`flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-background-secondary text-xs ${
                link.isExpired ? "opacity-50" : ""
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1 mr-3">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-accent-secondary truncate">
                    {`https://you.md/ctx/${username}/${link.token}`}
                  </code>
                  {!link.isExpired && (
                    <CopyButton
                      text={`https://you.md/ctx/${username}/${link.token}`}
                      className="shrink-0 px-2 py-0.5 border border-border rounded text-foreground-secondary hover:text-foreground hover:border-accent-secondary transition-colors text-xs"
                    />
                  )}
                </div>
                <div className="text-foreground-secondary">
                  {link.scope} -- {link.useCount} uses --{" "}
                  {link.isExpired
                    ? "expired"
                    : `expires ${typeof link.expiresAt === "string" ? link.expiresAt.split("T")[0] : "never"}`}
                </div>
              </div>
              {!link.isExpired && (
                <button
                  onClick={() => revokeLink({ clerkId, linkId: link.id })}
                  className="text-accent-primary hover:underline shrink-0"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-foreground-secondary">
          No context links yet. Create one to share your identity with agents.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-5 py-3.5 text-left bg-background-secondary hover:bg-background-secondary/80 transition-colors"
      >
        <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">
          {title}
        </h2>
        <svg
          className={`w-4 h-4 text-foreground-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

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
      <label className="block text-xs text-foreground-secondary mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm bg-background-secondary border border-border rounded-lg outline-none focus:border-accent-secondary focus:shadow-[0_0_12px_rgba(122,190,208,0.15)] transition-all text-foreground placeholder:text-mist/40"
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
      <label className="block text-xs text-foreground-secondary mb-1.5">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 text-sm bg-background-secondary border border-border rounded-lg outline-none focus:border-accent-secondary focus:shadow-[0_0_12px_rgba(122,190,208,0.15)] transition-all resize-y text-foreground placeholder:text-mist/40 font-mono"
      />
    </div>
  );
}
