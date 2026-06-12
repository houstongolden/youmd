"use client";

import Link from "next/link";
import FadeUp from "./FadeUp";
import ThemeToggle from "./ThemeToggle";
import { CliInstallTabs } from "@/components/install/CliInstallTabs";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";

const footerLinks = [
  ["create", "/create"],
  ["docs", "/docs"],
  ["profiles", "/profiles"],
  ["github", "https://github.com/houstongolden/youmd"],
  ["npm", "https://www.npmjs.com/package/youmd"],
];

function FooterLink({ href, children }: { href: string; children: string }) {
  const external = href.startsWith("http");
  const className =
    "inline-flex min-h-11 items-center font-mono text-[11px] text-muted-foreground/62 transition-colors hover:text-accent";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        &gt; {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      &gt; {children}
    </Link>
  );
}

const CTAFooter = () => {
  return (
    <>
      <Section id="get-started" hero className="overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[92px] -translate-x-1/2 -translate-y-1/2 beam-glow opacity-70" />
        <Container size="narrow" className="relative z-10">
          <FadeUp>
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent/75">
                -- get started --
              </p>
              <h2 className="mt-4 font-mono text-[30px] leading-tight text-foreground md:text-[42px]">
                make every new agent session start with you
              </h2>
              <p className="mx-auto mt-4 max-w-[620px] text-[16px] leading-relaxed text-muted-foreground">
                Build your context layer once, add the stacks that reflect how you work,
                and let agents meet the same version of you everywhere.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/create" variant="primary" size="lg">
                  create your you.md
                </ButtonLink>
                <ButtonLink href="/docs" variant="secondary" size="lg">
                  read docs
                </ButtonLink>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.08}>
            <CliInstallTabs
              className="mx-auto mt-7 max-w-[520px] text-left opacity-90"
              title="runtime install"
              helperText="one curl, brain + stacks underneath"
            />
          </FadeUp>
        </Container>
      </Section>

      <footer className="px-6 py-10">
        <div className="mx-auto max-w-[1120px] border-t border-border pt-9">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 md:justify-between">
            {footerLinks.map(([label, href]) => (
              <FooterLink key={label} href={href}>
                {label}
              </FooterLink>
            ))}
          </div>

          <div className="mt-9 flex flex-col items-center justify-between gap-4 border-t border-border/45 pt-5 md:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center px-3 font-mono text-[12px] text-accent transition-colors hover:text-accent-light"
            >
              you.md
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="font-mono text-[10px] text-muted-foreground/50">
                you/v1
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default CTAFooter;
