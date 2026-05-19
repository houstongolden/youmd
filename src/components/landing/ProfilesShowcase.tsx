"use client";

import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import { sampleProfiles } from "./sampleProfiles";
import FadeUp from "./FadeUp";
import { Container, Section } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

const tools = ["Claude Code", "Cursor", "Codex", "ChatGPT", "MCP", "plain URL"];

const ProfilesShowcase = () => {
  const claimed = sampleProfiles.find((profile) => profile.isClaimed) ?? sampleProfiles[0];
  const teasers = sampleProfiles.filter((profile) => !profile.isClaimed).slice(0, 3);

  return (
    <Section compact>
      <Container>
        <FadeUp>
          <Card padding="compact" className="grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent/70">
                -- social proof --
              </p>
              <p className="mt-3 max-w-[620px] font-mono text-[16px] leading-relaxed text-foreground/88">
                one identity file that every agent can read. public enough to share,
                private enough to control.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <span
                    key={tool}
                    className="border border-border bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground/65"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <Link
                href={`/${claimed.username}`}
                className="group grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border border-accent/25 bg-accent-wash/35 p-3 transition-colors hover:border-accent/45"
              >
                <div className="h-10 w-10 overflow-hidden border border-border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={claimed.avatarUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-[13px] text-foreground">
                      {claimed.name}
                    </span>
                    <Shield size={11} className="shrink-0 text-success" />
                  </div>
                  <p className="truncate font-mono text-[10px] text-muted-foreground/60">
                    {claimed.agentMetrics.totalReads.toLocaleString()} reads · @{claimed.username}
                  </p>
                </div>
                <ArrowRight size={14} className="text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>

              <div className="grid grid-cols-3 gap-2">
                {teasers.map((profile) => (
                  <div key={profile.username} className="border border-border/70 bg-background p-2">
                    <p className="truncate font-mono text-[10px] text-muted-foreground/65">
                      @{profile.username}
                    </p>
                    <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground/35">
                      unclaimed
                    </p>
                  </div>
                ))}
              </div>

              <ButtonLink href="/profiles" variant="terminal-link" size="sm" className="justify-start">
                view identity network
              </ButtonLink>
            </div>
          </Card>
        </FadeUp>
      </Container>
    </Section>
  );
};

export default ProfilesShowcase;
