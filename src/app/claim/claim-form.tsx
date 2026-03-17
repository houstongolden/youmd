"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

export function ClaimForm() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const checkUsername = useQuery(
    api.users.checkUsername,
    username.length >= 3 ? { username } : "skip"
  );

  const createUser = useMutation(api.users.createUser);

  const isAvailable = checkUsername?.available ?? null;
  const availabilityReason = checkUsername?.reason ?? null;

  const handleClaim = useCallback(async () => {
    if (!isSignedIn || !user) {
      router.push("/sign-up");
      return;
    }

    if (!isAvailable) return;

    try {
      setError(null);
      setClaiming(true);
      await createUser({
        clerkId: user.id,
        username: username.toLowerCase(),
        email: user.emailAddresses[0]?.emailAddress ?? "",
        displayName: user.fullName ?? undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim username");
      setClaiming(false);
    }
  }, [isSignedIn, user, isAvailable, createUser, username, router]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-mono text-lg tracking-tight text-foreground">
          you.md
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-10">
          {/* Branding */}
          <div className="text-center space-y-3">
            <h1 className="font-mono text-3xl tracking-tight text-foreground">
              you.md
            </h1>
            <p className="text-foreground-secondary text-sm tracking-wide">
              your identity on the agent internet
            </p>
          </div>

          {/* Claim section */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground text-center">
              Claim your username
            </h2>
            <p className="text-foreground-secondary text-sm text-center">
              Your identity will live at{" "}
              <span className="font-mono text-accent-secondary">
                you.md/{username || "..."}
              </span>
            </p>
          </div>

          <div className="space-y-5">
            <div className="relative">
              <div className="flex items-center border border-border rounded-lg bg-background-secondary overflow-hidden focus-within:border-accent-secondary focus-within:shadow-[0_0_16px_rgba(122,190,208,0.2)] transition-all duration-200">
                <span className="pl-4 pr-1 text-foreground-secondary font-mono text-sm select-none">
                  you.md/
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const val = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "");
                    setUsername(val);
                    setError(null);
                  }}
                  placeholder="yourname"
                  className="flex-1 py-3.5 pr-4 bg-transparent font-mono text-sm outline-none text-foreground placeholder:text-mist/50"
                  maxLength={30}
                  autoFocus
                />
              </div>

              {/* Availability indicator */}
              {username.length >= 3 && checkUsername && (
                <p
                  className={`mt-2.5 text-xs font-medium ${isAvailable ? "text-success" : "text-accent-primary"}`}
                >
                  {isAvailable
                    ? `you.md/${username} is available`
                    : availabilityReason}
                </p>
              )}

              {username.length > 0 && username.length < 3 && (
                <p className="mt-2.5 text-xs text-foreground-secondary">
                  Username must be at least 3 characters
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-accent-primary">{error}</p>
            )}

            <button
              onClick={handleClaim}
              disabled={!isAvailable || username.length < 3 || claiming}
              className="w-full py-3.5 bg-accent-primary text-void rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!isLoaded
                ? "Loading..."
                : claiming
                  ? "Claiming..."
                  : !isSignedIn
                    ? "Sign up to claim"
                    : "Claim username"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
