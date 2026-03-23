"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback } from "react";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import type { Id } from "../../../convex/_generated/dataModel";

interface PrivateLink {
  label: string;
  url: string;
}

interface PrivateProject {
  name: string;
  description: string;
  status: string;
}

interface PrivateContextPaneProps {
  clerkId: string;
  profileId: Id<"profiles">;
  username: string;
}

export function PrivateContextPane({ clerkId, profileId, username }: PrivateContextPaneProps) {
  const privateCtx = useQuery(api.private.getPrivateContext, { clerkId, profileId });
  const updatePrivateContext = useMutation(api.private.updatePrivateContext);

  const [notes, setNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // Derive state from query (local overrides when editing)
  const currentNotes = notes ?? privateCtx?.privateNotes ?? "";
  const currentLinks: PrivateLink[] = Array.isArray(privateCtx?.internalLinks) ? privateCtx.internalLinks as PrivateLink[] : [];
  const currentProjects: PrivateProject[] = Array.isArray(privateCtx?.privateProjects) ? privateCtx.privateProjects as PrivateProject[] : [];

  const save = useCallback(async (updates: {
    privateNotes?: string;
    internalLinks?: PrivateLink[];
    privateProjects?: PrivateProject[];
  }) => {
    setSaving(true);
    try {
      await updatePrivateContext({
        clerkId,
        profileId,
        ...(updates.privateNotes !== undefined ? { privateNotes: updates.privateNotes } : {}),
        ...(updates.internalLinks !== undefined ? { internalLinks: updates.internalLinks } : {}),
        ...(updates.privateProjects !== undefined ? { privateProjects: updates.privateProjects } : {}),
      });
      setLastSaved(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      // silently handle
    }
    setSaving(false);
  }, [clerkId, profileId, updatePrivateContext]);

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    const updated = [...currentLinks, { label: newLinkLabel.trim() || newLinkUrl.trim(), url: newLinkUrl.trim() }];
    setNewLinkLabel("");
    setNewLinkUrl("");
    save({ internalLinks: updated });
  };

  const removeLink = (i: number) => {
    const updated = currentLinks.filter((_, idx) => idx !== i);
    save({ internalLinks: updated });
  };

  const addProject = () => {
    if (!newProjectName.trim()) return;
    const updated = [...currentProjects, { name: newProjectName.trim(), description: newProjectDesc.trim(), status: "active" }];
    setNewProjectName("");
    setNewProjectDesc("");
    save({ privateProjects: updated });
  };

  const removeProject = (i: number) => {
    const updated = currentProjects.filter((_, idx) => idx !== i);
    save({ privateProjects: updated });
  };

  const isLoading = privateCtx === undefined;

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>
        <div className="flex items-center justify-between w-full">
          <span>private context</span>
          {lastSaved && (
            <span className="font-mono text-[9px] text-[hsl(var(--success))] opacity-60">
              saved {lastSaved}
            </span>
          )}
        </div>
      </PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-40 font-mono mb-6">
          only visible to you and agents with scoped access tokens.
        </p>

        {isLoading ? (
          <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
            loading...
          </p>
        ) : (
          <>
            {/* Notes */}
            <SectionLabel>notes</SectionLabel>
            <textarea
              value={currentNotes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => save({ privateNotes: currentNotes })}
              rows={6}
              placeholder="private notes, goals, reminders..."
              className="w-full bg-[hsl(var(--bg))] border border-[hsl(var(--border))] p-3 font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80 placeholder:text-[hsl(var(--text-secondary))]/20 resize-y focus:outline-none focus:border-[hsl(var(--accent))]/40 transition-colors"
              style={{ borderRadius: "2px" }}
            />

            <Divider />

            {/* Private Links */}
            <SectionLabel>private links</SectionLabel>
            {currentLinks.length > 0 && (
              <div className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] mb-3 space-y-1" style={{ borderRadius: "2px" }}>
                {currentLinks.map((link, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-[hsl(var(--border))]/20 last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 truncate block">{link.label}</span>
                      <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 truncate block">{link.url}</span>
                    </div>
                    <button onClick={() => removeLink(i)} className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-60 hover:opacity-100 ml-2 shrink-0 transition-opacity">
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="label"
                className="flex-1 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-2 py-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 placeholder:text-[hsl(var(--text-secondary))]/20 focus:outline-none focus:border-[hsl(var(--accent))]/40"
                style={{ borderRadius: "2px" }}
              />
              <input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => e.key === "Enter" && addLink()}
                className="flex-[2] bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-2 py-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 placeholder:text-[hsl(var(--text-secondary))]/20 focus:outline-none focus:border-[hsl(var(--accent))]/40"
                style={{ borderRadius: "2px" }}
              />
              <button
                onClick={addLink}
                className="font-mono text-[10px] text-[hsl(var(--accent))] px-2 py-1.5 border border-[hsl(var(--accent))]/30 hover:bg-[hsl(var(--accent))]/10 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                +
              </button>
            </div>

            <Divider />

            {/* Private Projects */}
            <SectionLabel>private projects</SectionLabel>
            {currentProjects.length > 0 && (
              <div className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] mb-3 space-y-2" style={{ borderRadius: "2px" }}>
                {currentProjects.map((proj, i) => (
                  <div key={i} className="flex items-start justify-between py-1.5 border-b border-[hsl(var(--border))]/20 last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80 block">{proj.name}</span>
                      {proj.description && <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 block">{proj.description}</span>}
                      <span className="font-mono text-[9px] text-[hsl(var(--success))] opacity-60">{proj.status}</span>
                    </div>
                    <button onClick={() => removeProject(i)} className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-60 hover:opacity-100 ml-2 shrink-0 transition-opacity">
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="project name"
                className="flex-1 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-2 py-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 placeholder:text-[hsl(var(--text-secondary))]/20 focus:outline-none focus:border-[hsl(var(--accent))]/40"
                style={{ borderRadius: "2px" }}
              />
              <input
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="description (optional)"
                onKeyDown={(e) => e.key === "Enter" && addProject()}
                className="flex-[2] bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-2 py-1.5 font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 placeholder:text-[hsl(var(--text-secondary))]/20 focus:outline-none focus:border-[hsl(var(--accent))]/40"
                style={{ borderRadius: "2px" }}
              />
              <button
                onClick={addProject}
                className="font-mono text-[10px] text-[hsl(var(--accent))] px-2 py-1.5 border border-[hsl(var(--accent))]/30 hover:bg-[hsl(var(--accent))]/10 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                +
              </button>
            </div>

            {saving && (
              <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse mt-4">
                saving...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
