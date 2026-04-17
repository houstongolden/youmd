"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";
import { useUser } from "@/lib/you-auth";

type Step = "boot" | "email" | "sending" | "verify" | "verifying" | "done";

export default function SignInPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [step, setStep] = useState<Step>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [email, setEmail] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  useEffect(() => {
    if (isSignedIn) router.replace("/shell");
  }, [isSignedIn, router]);

  const addLine = useCallback((content: ReactNode, className?: string) => {
    const id = `l${lineCounter.current++}`;
    setLines((prev) => [...prev, { id, content, className }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, step]);

  useEffect(() => {
    const timers = [
      setTimeout(() => addLine("you.md v0.1.0", "text-[hsl(var(--accent))]"), 200),
      setTimeout(
        () =>
          addLine(
            "identity context protocol for the agent internet",
            "text-[hsl(var(--text-secondary))] opacity-60"
          ),
        600
      ),
      setTimeout(() => addLine("\u00A0"), 900),
      setTimeout(
        () => addLine("passwords are dead. enter your email.", "text-[hsl(var(--text-secondary))] opacity-70"),
        1200
      ),
      setTimeout(() => setStep("email"), 1350),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addLine]);

  const handleEmail = useCallback(
    async (value: string) => {
      setEmail(value);
      addLine(
        <span>
          <span className="text-[hsl(var(--accent))]">email:</span>{" "}
          <span className="text-[hsl(var(--text-secondary))]">{value}</span>
        </span>
      );
      addLine("\u00A0");
      setStep("sending");
      addLine("sending verification code...", "text-[hsl(var(--text-secondary))] opacity-50");

      try {
        const res = await fetch("/api/auth/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value, type: "login" }),
        });
        const data = (await res.json()) as { error?: string; devCode?: string };
        if (!res.ok) {
          throw new Error(data.error || "could not send verification code.");
        }
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} code sent to {value}</span>
        );
        if (data.devCode) {
          addLine(
            <span className="text-[hsl(var(--text-secondary))] opacity-50">
              dev code: {data.devCode}
            </span>
          );
        }
        addLine("\u00A0");
        addLine("enter verification code.", "text-[hsl(var(--text-secondary))] opacity-70");
        setStep("verify");
      } catch (error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: {error instanceof Error ? error.message : "authentication failed."}
          </span>
        );
        addLine("\u00A0");
        setStep("email");
      }
    },
    [addLine]
  );

  const handleVerify = useCallback(
    async (code: string) => {
      addLine(
        <span>
          <span className="text-[hsl(var(--accent))]">code:</span>{" "}
          <span className="text-[hsl(var(--text-secondary))]">{code}</span>
        </span>
      );
      addLine("\u00A0");
      setStep("verifying");
      addLine("verifying...", "text-[hsl(var(--text-secondary))] opacity-50");

      try {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "verification failed.");
        }
        addLine(
          <span className="text-[hsl(var(--success))]">{"\u2713"} authenticated</span>
        );
        addLine(
          <span className="text-[hsl(var(--text-secondary))] opacity-60">
            {"\u2192"} redirecting to dashboard...
          </span>
        );
        setStep("done");
        router.push("/shell");
        router.refresh();
      } catch (error) {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: {error instanceof Error ? error.message : "verification failed."}
          </span>
        );
        addLine("\u00A0");
        setStep("verify");
      }
    },
    [addLine, email, router]
  );

  const isInputStep = step === "email" || step === "verify";

  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md — authenticate" asHeading />

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 font-mono text-[14px] leading-relaxed"
          >
            {lines.map((line) => (
              <div key={line.id} className={line.className || ""}>
                {line.content || "\u00A0"}
              </div>
            ))}
          </div>

          {isInputStep && (
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3 pb-5">
              <TerminalAuthInput
                prompt=">"
                placeholder={step === "email" ? "email" : "______"}
                type={step === "email" ? "email" : "text"}
                autoComplete={step === "email" ? "email" : "one-time-code"}
                inputMode={step === "email" ? "email" : "numeric"}
                name={step === "email" ? "email" : "verification-code"}
                ariaLabel={step === "email" ? "email address" : "verification code"}
                onSubmit={step === "email" ? handleEmail : handleVerify}
              />
            </div>
          )}
        </div>

        {!isInputStep && (
          <div className="mt-3 text-center shrink-0 flex flex-col gap-1">
            <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              need to initialize?{" "}
              <Link
                href="/sign-up"
                className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
              >
                sign up
              </Link>
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
