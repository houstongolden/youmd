"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";
import { useUser } from "@/lib/you-auth";

type Step = "boot" | "email" | "username" | "name" | "sending" | "verify" | "verifying" | "done";

export default function SignUpPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  const [step, setStep] = useState<Step>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
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
        () => addLine("enter your email to begin.", "text-[hsl(var(--text-secondary))] opacity-70"),
        1200
      ),
      setTimeout(() => setStep("email"), 1350),
    ];
    return () => timers.forEach(clearTimeout);
  }, [addLine]);

  const handleEmail = useCallback((value: string) => {
    setEmail(value);
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">email:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{value}</span>
      </span>
    );
    addLine("\u00A0");
    addLine("claim your username.", "text-[hsl(var(--text-secondary))] opacity-70");
    setStep("username");
  }, [addLine]);

  const handleUsername = useCallback(async (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">username:</span>{" "}
        <span className="text-[hsl(var(--text-secondary))]">{clean}</span>
      </span>
    );
    try {
      const res = await fetch(`/api/v1/check-username?username=${encodeURIComponent(clean)}`);
      const data = (await res.json()) as { available?: boolean; reason?: string | null };
      if (!data.available) {
        throw new Error(data.reason || "username is not available.");
      }
      setUsername(clean);
      addLine(
        <span className="text-[hsl(var(--success))]">{"\u2713"} @{clean} is available</span>
      );
      addLine("\u00A0");
      addLine("what should we call you?", "text-[hsl(var(--text-secondary))] opacity-70");
      setStep("name");
    } catch (error) {
      addLine(
        <span className="text-[hsl(var(--accent))]">
          ERR: {error instanceof Error ? error.message : "invalid username."}
        </span>
      );
      addLine("\u00A0");
      setStep("username");
    }
  }, [addLine]);

  const handleName = useCallback(async (value: string) => {
    setDisplayName(value);
    addLine(
      <span>
        <span className="text-[hsl(var(--accent))]">name:</span>{" "}
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
        body: JSON.stringify({
          email,
          type: "signup",
          username,
          displayName: value,
        }),
      });
      const data = (await res.json()) as { error?: string; devCode?: string };
      if (!res.ok) {
        throw new Error(data.error || "could not send verification code.");
      }
      addLine(
        <span className="text-[hsl(var(--success))]">{"\u2713"} code sent to {email}</span>
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
          ERR: {error instanceof Error ? error.message : "signup failed."}
        </span>
      );
      addLine("\u00A0");
      setStep("name");
    }
  }, [addLine, email, username]);

  const handleVerify = useCallback(async (code: string) => {
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
        <span className="text-[hsl(var(--success))]">{"\u2713"} account created</span>
      );
      addLine(
        <span className="text-[hsl(var(--text-secondary))] opacity-60">
          {"\u2192"} redirecting to initialize...
        </span>
      );
      setStep("done");
      router.push("/initialize");
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
  }, [addLine, email, router]);

  const isInputStep = ["email", "username", "name", "verify"].includes(step);

  const inputProps =
    step === "email"
      ? {
          placeholder: "email",
          type: "email" as const,
          autoComplete: "email",
          inputMode: "email" as const,
          name: "email",
          ariaLabel: "email address",
          onSubmit: handleEmail,
        }
      : step === "username"
        ? {
            placeholder: "username",
            type: "text" as const,
            autoComplete: "username",
            inputMode: "text" as const,
            name: "username",
            ariaLabel: "username",
            onSubmit: handleUsername,
          }
        : step === "name"
          ? {
              placeholder: "display name",
              type: "text" as const,
              autoComplete: "name",
              inputMode: "text" as const,
              name: "name",
              ariaLabel: "display name",
              onSubmit: handleName,
            }
          : {
              placeholder: "______",
              type: "text" as const,
              autoComplete: "one-time-code",
              inputMode: "numeric" as const,
              name: "verification-code",
              ariaLabel: "verification code",
              onSubmit: handleVerify,
            };

  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md — sign up" asHeading />

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
              <TerminalAuthInput prompt=">" {...inputProps} />
            </div>
          )}
        </div>

        {!isInputStep && (
          <div className="mt-3 text-center shrink-0 flex flex-col gap-1">
            <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              already initialized?{" "}
              <Link
                href="/sign-in"
                className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
              >
                sign in
              </Link>
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
