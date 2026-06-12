"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import FadeUp from "./FadeUp";
import { Container, Section } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";
import { imgToAscii, loadCorsImage, lumToColor, type AsciiCell } from "./ascii";

/**
 * U9 — homepage magic moment.
 * Type a github / x handle into a terminal-style prompt, see a live ASCII
 * portrait generated client-side, then funnel into /create with the handle
 * prefilled. Zero forms — the input is part of the terminal line.
 */

const PORTRAIT_COLS = 72;
const REVEAL_MS_PER_ROW = 34;

type Status = "idle" | "loading" | "done" | "error";

function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 39);
}

/** Avatar sources, tried in order. fallback=false makes unavatar 404 instead of returning a placeholder. */
function avatarSources(handle: string): string[] {
  return [
    `https://unavatar.io/github/${handle}?fallback=false`,
    `https://github.com/${handle}.png`,
    `https://unavatar.io/x/${handle}?fallback=false`,
  ];
}

const HandlePreview = () => {
  const [input, setInput] = useState("");
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [ascii, setAscii] = useState<AsciiCell[][] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);

  // Line-by-line reveal animation after generation.
  useEffect(() => {
    if (!ascii || revealed >= ascii.length) return;
    const t = setInterval(
      () => setRevealed((r) => Math.min(r + 1, ascii.length)),
      REVEAL_MS_PER_ROW
    );
    return () => clearInterval(t);
  }, [ascii, revealed]);

  const generate = useCallback(async () => {
    const h = cleanHandle(input);
    if (!h) return;
    const id = ++runId.current;
    setHandle(h);
    setStatus("loading");
    setAscii(null);
    setRevealed(0);

    let img: HTMLImageElement | null = null;
    for (const src of avatarSources(h)) {
      try {
        img = await loadCorsImage(src);
        break;
      } catch {
        // try the next source
      }
    }
    if (id !== runId.current) return; // a newer run superseded this one

    if (!img) {
      setStatus("error");
      return;
    }
    try {
      const data = imgToAscii(img, PORTRAIT_COLS);
      if (id !== runId.current) return;
      if (!data.length) {
        setStatus("error");
        return;
      }
      setAscii(data);
      setStatus("done");
    } catch {
      if (id === runId.current) setStatus("error");
    }
  }, [input]);

  const fullyRevealed = status === "done" && ascii !== null && revealed >= ascii.length;

  return (
    <Section id="preview" className="border-t border-border">
      <Container size="narrow">
        <FadeUp>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            -- try it --
          </p>
          <p className="mb-8 max-w-md font-mono text-[15px] font-light leading-[1.8] tracking-tight text-foreground/90 md:text-[17px]">
            see yourself the way agents do.
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <TerminalCard title="youmd — preview">
            <div>
              {/* Terminal prompt line — the input is part of the line, not a form */}
              <div
                className="flex min-h-11 cursor-text items-center font-mono text-[13px] md:text-[14px]"
                onClick={() => inputRef.current?.focus()}
              >
                <span className="select-none text-accent" aria-hidden="true">
                  ${" "}
                </span>
                <span className="select-none whitespace-pre text-foreground/80">
                  youmd preview{" "}
                </span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void generate();
                  }}
                  placeholder="your github handle"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="none"
                  enterKeyHint="go"
                  aria-label="your github or x handle"
                  className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[13px] text-accent caret-accent outline-none placeholder:text-muted-foreground/25 md:text-[14px]"
                />
                <span className="select-none font-mono text-[10px] text-muted-foreground/35">
                  enter ↵
                </span>
              </div>

              {/* Output area */}
              {status === "loading" && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground/50">
                  fetching avatar for {handle}...
                </p>
              )}

              {status === "error" && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground/50">
                  no avatar found for {handle}. try your github username.
                </p>
              )}

              {status === "done" && ascii && (
                <div className="mt-4">
                  <div
                    className="overflow-hidden border border-border bg-background px-2 py-2"
                    style={{ borderRadius: "var(--radius)" }}
                    aria-label={`ascii portrait generated from ${handle}'s avatar`}
                    role="img"
                  >
                    <div className="flex flex-col items-center">
                      {ascii.slice(0, revealed).map((row, y) => (
                        <div
                          key={y}
                          className="whitespace-pre font-mono text-[6px] leading-[1.04] sm:text-[8px] md:text-[9px]"
                        >
                          {row.map((cell, x) => (
                            <span key={x} style={{ color: lumToColor(cell.lum) }}>
                              {cell.ch}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quiet CTA — only after the reveal finishes */}
                  <div
                    className={`mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px] transition-opacity duration-500 ${
                      fullyRevealed ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="text-muted-foreground/55">
                      this is what agents could see.
                    </span>
                    <Link
                      href={`/create?handle=${encodeURIComponent(handle)}`}
                      className="text-accent transition-opacity hover:opacity-80"
                    >
                      claim {handle} &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </TerminalCard>
        </FadeUp>
      </Container>
    </Section>
  );
};

export default HandlePreview;
