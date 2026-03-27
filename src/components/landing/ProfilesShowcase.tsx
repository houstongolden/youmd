"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Shield, ArrowRight } from "lucide-react";
import { sampleProfiles } from "./sampleProfiles";
import FadeUp from "./FadeUp";
import AsciiAvatar from "./AsciiAvatar";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ProfilesShowcase = () => {
  const featured = sampleProfiles.slice(0, 6);

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-2xl mx-auto px-6">
        <FadeUp>
          <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
            -- live on the network --
          </p>
          <p className="text-muted-foreground text-[13px] font-body mb-10">
            every identity here is readable by any AI agent. see who&apos;s on the network.
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="terminal-panel">
            <div className="terminal-panel-header">
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <span className="ml-2 text-muted-foreground/60 font-mono text-[10px]">
                &gt; ls /profiles --active
              </span>
            </div>

            <div className="divide-y divide-border">
              {featured.map((profile, i) => (
                <motion.div
                  key={profile.username}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                >
                  <Link
                    href={`/${profile.username}`}
                    className="flex items-center gap-4 px-5 py-3.5 group hover:bg-accent-wash/40 transition-colors"
                  >
                    {/* Status dot */}
                    <span className="w-1.5 h-1.5 rounded-full bg-success/60 status-dot-pulse shrink-0" />

                    {/* Avatar */}
                    <div className="w-8 h-8 rounded overflow-hidden border border-[hsl(var(--border))] group-hover:border-accent/30 transition-colors shrink-0 bg-[hsl(var(--bg))] relative">
                      <AsciiAvatar
                        src={profile.avatarUrl}
                        cols={120}
                        canvasWidth={64}
                        className="w-full h-full object-cover"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.avatarUrl}
                        alt={profile.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[hsl(var(--text-primary))] font-mono text-[12px] font-medium truncate">
                          {profile.name}
                        </span>
                        {profile.verification.verified && (
                          <Shield
                            size={10}
                            className="text-success shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground font-mono text-[10px] truncate mt-0.5">
                        {profile.tagline}
                      </p>
                    </div>

                    {/* Metrics */}
                    <div className="hidden md:flex items-center gap-4 shrink-0">
                      <span className="text-accent/70 font-mono text-[9px]">
                        {profile.agentMetrics.totalReads.toLocaleString()}{" "}
                        reads
                      </span>
                      <span className="text-muted-foreground/50 font-mono text-[9px]">
                        {timeAgo(profile.updatedAt)}
                      </span>
                    </div>

                    <ArrowRight
                      size={12}
                      className="text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
              <span className="text-muted-foreground/50 font-mono text-[9px]">
                {featured.length} active &middot;{" "}
                {
                  featured.filter((p) => p.verification.verified)
                    .length
                }{" "}
                verified
              </span>
              <div className="flex items-center gap-4">
                <Link
                  href="/profiles"
                  className="text-accent/70 hover:text-accent font-mono text-[10px] transition-colors"
                >
                  &gt; view all
                </Link>
                <Link
                  href="/create"
                  className="text-muted-foreground/50 hover:text-accent font-mono text-[10px] transition-colors"
                >
                  &gt; build your own
                </Link>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
};

export default ProfilesShowcase;
