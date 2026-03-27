"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Shield, ArrowRight } from "lucide-react";
import { sampleProfiles } from "./sampleProfiles";
import FadeUp from "./FadeUp";

function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ProfilesShowcase = () => {
  const featured = sampleProfiles.slice(0, 12);
  const claimedCount = featured.filter(p => p.isClaimed).length;

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-2xl mx-auto px-6">
        <FadeUp>
          <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
            -- the network --
          </p>
          <p className="text-muted-foreground text-[13px] font-body mb-10">
            every identity is readable by any AI agent. claim yours or explore who&apos;s here.
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="terminal-panel">
            <div className="terminal-panel-header">
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <span className="ml-2 text-muted-foreground/60 font-mono text-[10px]">
                &gt; ls /profiles --featured
              </span>
            </div>

            <div className="divide-y divide-border">
              {featured.map((profile, i) => {
                const isClaimed = profile.isClaimed;
                const Wrapper = isClaimed ? Link : "div";
                const wrapperProps = isClaimed
                  ? { href: `/${profile.username}` }
                  : {};

                return (
                  <motion.div
                    key={profile.username}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                  >
                    {/* @ts-expect-error — dynamic wrapper */}
                    <Wrapper
                      {...wrapperProps}
                      className={`flex items-center gap-4 px-5 py-3.5 group transition-colors ${
                        isClaimed ? "hover:bg-accent-wash/40 cursor-pointer" : "opacity-60"
                      }`}
                    >
                      {/* Status dot */}
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isClaimed ? "bg-success/60 status-dot-pulse" : "bg-muted-foreground/20"
                      }`} />

                      {/* Avatar placeholder */}
                      <div className="w-8 h-8 overflow-hidden border border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--bg))] flex items-center justify-center">
                        {profile.avatarUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={profile.avatarUrl}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground/30">
                            {profile.name.charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[hsl(var(--text-primary))] font-mono text-[12px] font-medium truncate">
                            {profile.name}
                          </span>
                          {profile.verification.verified && (
                            <Shield size={10} className="text-success shrink-0" />
                          )}
                        </div>
                        <p className="text-muted-foreground font-mono text-[10px] truncate mt-0.5">
                          {profile.tagline}
                        </p>
                      </div>

                      {/* Right side — metrics or unclaimed label */}
                      <div className="hidden md:flex items-center gap-4 shrink-0">
                        {isClaimed ? (
                          <>
                            <span className="text-accent/70 font-mono text-[9px]">
                              {profile.agentMetrics.totalReads.toLocaleString()} reads
                            </span>
                            {profile.updatedAt > 0 && (
                              <span className="text-muted-foreground/40 font-mono text-[9px]">
                                {timeAgo(profile.updatedAt)}
                              </span>
                            )}
                            <ArrowRight
                              size={12}
                              className="text-muted-foreground/20 group-hover:text-accent/60 group-hover:translate-x-0.5 transition-all"
                            />
                          </>
                        ) : (
                          <span className="font-mono text-[9px] text-muted-foreground/30 border border-border/50 px-2 py-0.5" style={{ borderRadius: "2px" }}>
                            unclaimed
                          </span>
                        )}
                      </div>
                    </Wrapper>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <span className="font-mono text-[9px] text-muted-foreground/40">
                {claimedCount} claimed &middot; {featured.length - claimedCount} unclaimed &middot; claim yours free
              </span>
              <div className="flex items-center gap-4">
                <Link
                  href="/profiles"
                  className="font-mono text-[10px] text-muted-foreground/50 hover:text-accent transition-colors"
                >
                  &gt; view all
                </Link>
                <Link
                  href="/create"
                  className="font-mono text-[10px] text-accent/70 hover:text-accent transition-colors"
                >
                  &gt; claim yours
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
