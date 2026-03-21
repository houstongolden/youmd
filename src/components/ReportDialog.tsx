"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const REASONS = [
  { value: "impersonation", label: "not this person" },
  { value: "spam", label: "false / misleading info" },
  { value: "offensive", label: "harmful or abusive" },
  { value: "private_info", label: "private info exposed" },
  { value: "duplicate", label: "duplicate profile" },
];

interface ReportDialogProps {
  profileId: Id<"profiles">;
}

export function ReportDialog({ profileId }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const reportProfile = useMutation(api.profiles.reportProfile);

  const handleSubmit = async () => {
    if (!reason) return;
    setError("");
    try {
      await reportProfile({ profileId, reason, details: details || undefined });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setReason("");
        setDetails("");
      }, 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "failed to submit report");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60 transition-opacity"
      >
        report
      </button>
    );
  }

  return (
    <div className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4 space-y-3" style={{ borderRadius: "2px" }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-[hsl(var(--text-secondary))]">
          report profile
        </span>
        <button
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70"
        >
          cancel
        </button>
      </div>

      {submitted ? (
        <p className="font-mono text-[12px] text-[hsl(var(--success))]">
          {"\u2713"} report submitted — we will review it shortly.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`block w-full text-left font-mono text-[11px] px-3 py-1.5 border transition-colors ${
                  reason === r.value
                    ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))] bg-[hsl(var(--accent-wash))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent))]/30"
                }`}
                style={{ borderRadius: "2px" }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="additional details (optional)"
            className="w-full bg-[hsl(var(--bg))] border border-[hsl(var(--border))] p-2 font-mono text-[11px] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-secondary))]/30 resize-none h-16 outline-none"
            style={{ borderRadius: "2px" }}
          />
          {error && (
            <p className="font-mono text-[11px] text-[hsl(var(--accent))]">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!reason}
            className="w-full py-2 font-mono text-[11px] bg-[hsl(var(--accent))] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[hsl(var(--accent-dark))] transition-colors"
            style={{ borderRadius: "2px" }}
          >
            submit report
          </button>
        </>
      )}
    </div>
  );
}
