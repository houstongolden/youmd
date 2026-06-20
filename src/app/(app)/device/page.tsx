"use client";

/**
 * /device — device-flow approval page (U7, RFC 8628-shaped).
 *
 * `you login` shows the user an 8-char code and sends them here. The page
 * requires a signed-in web session (it routes through /sign-in and back),
 * validates the code via api.auth.lookupDeviceAuth, shows what is asking for
 * access, and lets the user approve or deny. The API key itself is never
 * minted or shown here — the CLI collects it on its next poll.
 */

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import AsciiAvatar, { type PreRenderedPortrait } from "@/components/AsciiAvatar";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { TerminalAuthInput } from "@/components/terminal/TerminalAuthInput";
import { useUser } from "@/lib/you-auth";

type Step = "boot" | "code" | "checking" | "confirm" | "resolving" | "done" | "denied";

type DeviceInfo = {
  clientName: string;
  requestedAt: number;
  expiresAt: number;
};

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function SessionFallback() {
  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center">
      <span className="font-mono text-[13px] text-[hsl(var(--text-secondary))] opacity-50">
        checking session...
      </span>
    </main>
  );
}

export default function DevicePage() {
  // useSearchParams (inside DeviceApproval) requires a Suspense boundary
  // for prerendering.
  return (
    <Suspense fallback={<SessionFallback />}>
      <DeviceApproval />
    </Suspense>
  );
}

function DeviceApproval() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { isAuthenticated } = useConvexAuth();

  const lookupDevice = useMutation(api.auth.lookupDeviceAuth);
  const resolveDevice = useMutation(api.auth.resolveDeviceAuth);
  const convexUser = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user?.id ? { clerkId: user.id } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );

  const [step, setStep] = useState<Step>("boot");
  const [lines, setLines] = useState<{ id: string; content: ReactNode; className?: string }[]>([]);
  const [userCode, setUserCode] = useState("");
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const lineCounter = useRef(0);
  const autoLookupDone = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const codeParam = normalizeCode(searchParams.get("code") ?? "").slice(0, 8);
  const approvalPath = pathname === "/auth" ? "/auth" : "/device";
  const profileRecord = userProfile as Record<string, unknown> | null | undefined;
  const username = convexUser?.username ?? user?.username ?? "you";
  const displayName =
    (typeof profileRecord?.displayName === "string" && profileRecord.displayName) ||
    (typeof profileRecord?.name === "string" && profileRecord.name) ||
    user?.fullName ||
    user?.firstName ||
    username;
  const avatarUrl =
    (typeof profileRecord?.avatarUrl === "string" && profileRecord.avatarUrl) ||
    user?.imageUrl ||
    "";
  const storedPortrait =
    profileRecord?.portrait && typeof profileRecord.portrait === "object"
      ? (profileRecord.portrait as PreRenderedPortrait)
      : null;

  const addLine = useCallback((content: ReactNode, className?: string) => {
    const id = `l${lineCounter.current++}`;
    setLines((prev) => [...prev, { id, content, className }]);
  }, []);

  // Not signed in → route through sign-in and come back with the code.
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const next = codeParam ? `${approvalPath}?code=${codeParam}` : approvalPath;
    router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
  }, [isLoaded, isSignedIn, codeParam, approvalPath, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, step]);

  const reasonMessage = useCallback((reason: string) => {
    if (reason === "locked_out") {
      return "too many invalid codes. wait a few minutes and try again.";
    }
    return "invalid or expired code. check your terminal and try again.";
  }, []);

  const handleLookup = useCallback(
    async (raw: string) => {
      const code = normalizeCode(raw);
      if (!code) return;
      addLine(
        <span>
          <span className="text-[hsl(var(--accent))]">code:</span>{" "}
          <span className="text-[hsl(var(--text-secondary))]">{formatCode(code)}</span>
        </span>
      );
      setStep("checking");
      addLine("checking code...", "text-[hsl(var(--text-secondary))] opacity-50");

      try {
        const result = await lookupDevice({ userCode: code });
        if (!result.ok) {
          addLine(
            <span className="text-[hsl(var(--accent))]">ERR: {reasonMessage(result.reason)}</span>
          );
          addLine(" ");
          setStep("code");
          return;
        }
        setUserCode(code);
        setDevice(result.device);
        addLine(
          <span className="text-[hsl(var(--success))]">{"✓"} code recognized</span>
        );
        addLine(" ");
        setStep("confirm");
      } catch {
        addLine(
          <span className="text-[hsl(var(--accent))]">
            ERR: could not verify the code. try again.
          </span>
        );
        addLine(" ");
        setStep("code");
      }
    },
    [addLine, lookupDevice, reasonMessage]
  );

  const handleResolve = useCallback(
    async (approve: boolean) => {
      setStep("resolving");
      addLine(
        approve ? "authorizing device..." : "denying device...",
        "text-[hsl(var(--text-secondary))] opacity-50"
      );
      try {
        const result = await resolveDevice({ userCode, approve });
        if (!result.ok) {
          addLine(
            <span className="text-[hsl(var(--accent))]">ERR: {reasonMessage(result.reason)}</span>
          );
          addLine(" ");
          setStep("code");
          return;
        }
        if (result.status === "approved") {
          addLine(
            <span className="text-[hsl(var(--success))]">{"✓"} device authorized</span>
          );
          addLine(
            "return to your terminal — your cli will pick it up within a few seconds.",
            "text-[hsl(var(--text-secondary))] opacity-70"
          );
          setStep("done");
        } else {
          addLine(
            <span className="text-[hsl(var(--text-secondary))]">device denied. nothing was issued.</span>
          );
          setStep("denied");
        }
      } catch {
        addLine(
          <span className="text-[hsl(var(--accent))]">ERR: something went wrong. try again.</span>
        );
        addLine(" ");
        setStep("confirm");
      }
    },
    [addLine, resolveDevice, userCode, reasonMessage]
  );

  // Boot lines once signed in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || step !== "boot") return;
    addLine("you.md", "text-[hsl(var(--accent))]");
    addLine(
      "a device is asking to log in as @" + (user?.username ?? "you"),
      "text-[hsl(var(--text-secondary))] opacity-70"
    );
    addLine(" ");
    addLine(
      "enter the code shown in your terminal.",
      "text-[hsl(var(--text-secondary))] opacity-70"
    );
    const bootTimer = setTimeout(() => setStep("code"), 400);
    return () => clearTimeout(bootTimer);
  }, [isLoaded, isSignedIn, step, addLine, user]);

  // Auto-lookup when the CLI handed the code over in the URL.
  useEffect(() => {
    if (step !== "code" || !codeParam || autoLookupDone.current) return;
    autoLookupDone.current = true;
    const timer = setTimeout(() => void handleLookup(codeParam), 50);
    return () => clearTimeout(timer);
  }, [step, codeParam, handleLookup]);

  if (!isLoaded || !isSignedIn) {
    return <SessionFallback />;
  }

  if (step === "done") {
    return (
      <DeviceSuccessView
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        portrait={storedPortrait}
      />
    );
  }

  return (
    <main className="h-[100dvh] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 min-h-0">
        <div
          className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden min-h-0"
          style={{ borderRadius: "var(--radius)" }}
        >
          <TerminalHeader title="you.md — authorize device" asHeading />

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 font-mono text-[14px] leading-relaxed"
          >
            {lines.map((line) => (
              <div key={line.id} className={line.className || ""}>
                {line.content || " "}
              </div>
            ))}

            {step === "confirm" && device && (
              <div className="mt-2 border border-[hsl(var(--border))] p-4" style={{ borderRadius: "var(--radius)" }}>
                <div className="text-[hsl(var(--text-secondary))] opacity-60 text-[12px]">requesting access</div>
                <div className="mt-1 text-[hsl(var(--accent))]">{device.clientName}</div>
                <div className="mt-2 text-[hsl(var(--text-secondary))] opacity-60 text-[12px]">
                  requested {new Date(device.requestedAt).toLocaleTimeString()} · code expires{" "}
                  {new Date(device.expiresAt).toLocaleTimeString()}
                </div>
                <div className="mt-3 text-[hsl(var(--text-secondary))] opacity-70 text-[13px]">
                  approving signs this device in as @{user?.username} with full access to your you.md.
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleResolve(true)}
                    className="min-h-11 px-5 font-mono text-[14px] border border-[hsl(var(--accent))] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--bg))] transition-colors"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResolve(false)}
                    className="min-h-11 px-5 font-mono text-[14px] border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70 hover:opacity-100 transition-opacity"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    deny
                  </button>
                </div>
              </div>
            )}
          </div>

          {step === "code" && (
            <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3 pb-5">
              <TerminalAuthInput
                prompt=">"
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                name="device-code"
                ariaLabel="device code"
                initialValue={codeParam ? formatCode(codeParam) : undefined}
                onSubmit={handleLookup}
              />
            </div>
          )}
        </div>

        {step === "denied" && (
          <div className="mt-3 text-center shrink-0">
            <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              you can close this tab.
            </span>
          </div>
        )}
      </div>
    </main>
  );
}

function DeviceSuccessView({
  username,
  displayName,
  avatarUrl,
  portrait,
}: {
  username: string;
  displayName: string;
  avatarUrl: string;
  portrait: PreRenderedPortrait | null;
}) {
  return (
    <main className="min-h-[100dvh] bg-[hsl(var(--bg))] px-4 py-8 text-[hsl(var(--text-primary))]">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center">
        <section
          className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-5 py-8 text-center sm:px-8 sm:py-10"
          style={{ borderRadius: "var(--radius)" }}
        >
          <div
            className="auth-portrait mx-auto flex h-36 w-36 items-center justify-center overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--bg))] sm:h-40 sm:w-40"
            style={{ borderRadius: "var(--radius)" }}
          >
            {avatarUrl || portrait ? (
              <AsciiAvatar
                src={avatarUrl}
                cols={34}
                canvasWidth={160}
                format="block"
                showLoadingText={false}
                preRendered={portrait}
                className="w-full opacity-90"
                fallback={<FallbackYouMark />}
              />
            ) : (
              <FallbackYouMark />
            )}
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--accent))]">
            local agent connected
          </p>
          <h1 className="mt-3 font-mono text-2xl leading-tight text-[hsl(var(--text-primary))] sm:text-3xl">
            Nice work. You&apos;re authenticated.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[hsl(var(--text-secondary))]">
            you.md is now connected on web and your local agent as{" "}
            <span className="font-mono text-[hsl(var(--text-primary))]">@{username}</span>.
            Return to your terminal; the CLI will finish the handoff in a few seconds.
          </p>
          <p className="mt-3 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60">
            First time on this machine? Run `you pull`, then `you sync`, then `you`.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/shell"
              className="inline-flex min-h-11 items-center justify-center border border-[hsl(var(--accent))] px-5 font-mono text-[13px] text-[hsl(var(--accent))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--bg))]"
              style={{ borderRadius: "var(--radius)" }}
            >
              open shell
            </Link>
            <button
              type="button"
              onClick={() => window.close()}
              className="inline-flex min-h-11 items-center justify-center border border-[hsl(var(--border))] px-5 font-mono text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
              style={{ borderRadius: "var(--radius)" }}
            >
              close tab
            </button>
          </div>

          <div className="mt-8 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-45">
            {displayName ? `${displayName} / you.md runtime` : "you.md runtime"}
          </div>
        </section>
      </div>

      <style jsx>{`
        .auth-portrait {
          animation: authPortraitPulse 2.8s ease-in-out infinite;
          box-shadow: 0 0 0 1px hsl(var(--accent) / 0.08);
        }

        @keyframes authPortraitPulse {
          0%,
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 1px hsl(var(--accent) / 0.08),
              0 0 0 0 hsl(var(--accent) / 0);
          }
          50% {
            transform: translateY(-2px) scale(1.015);
            box-shadow: 0 0 0 1px hsl(var(--accent) / 0.22),
              0 0 42px 0 hsl(var(--accent) / 0.12);
          }
        }
      `}</style>
    </main>
  );
}

function FallbackYouMark() {
  return (
    <pre className="select-none font-mono text-[30px] leading-none tracking-[-0.08em] text-[hsl(var(--accent))] opacity-90">
      YOU
    </pre>
  );
}
