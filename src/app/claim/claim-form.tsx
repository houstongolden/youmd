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
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const checkUsername = useQuery(
    api.users.checkUsername,
    username.length >= 3 ? { username } : "skip"
  );

  const createUser = useMutation(api.users.createUser);

  // Update availability when query result changes
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
      await createUser({
        clerkId: user.id,
        username: username.toLowerCase(),
        email: user.emailAddresses[0]?.emailAddress ?? "",
        displayName: user.fullName ?? undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim username");
    }
  }, [isSignedIn, user, isAvailable, createUser, username, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-mono text-lg tracking-tight">
          you.md
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">Claim your username</h1>
            <p className="text-foreground-secondary text-sm">
              Your identity will live at{" "}
              <span className="font-mono text-sky">
                you.md/{username || "..."}
              </span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <div className="flex items-center border border-border rounded-md bg-background-secondary overflow-hidden focus-within:border-sky transition-colors">
                <span className="pl-4 pr-1 text-foreground-secondary font-mono text-sm">
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
                  className="flex-1 py-3 pr-4 bg-transparent font-mono text-sm outline-none text-foreground placeholder:text-mist/50"
                  maxLength={30}
                  autoFocus
                />
              </div>

              {/* Availability indicator */}
              {username.length >= 3 && checkUsername && (
                <p
                  className={`mt-2 text-xs ${isAvailable ? "text-green-400" : "text-coral"}`}
                >
                  {isAvailable
                    ? `you.md/${username} is available`
                    : availabilityReason}
                </p>
              )}

              {username.length > 0 && username.length < 3 && (
                <p className="mt-2 text-xs text-mist">
                  Username must be at least 3 characters
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-coral">{error}</p>
            )}

            <button
              onClick={handleClaim}
              disabled={!isAvailable || username.length < 3}
              className="w-full py-3 bg-coral text-void rounded-md font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!isLoaded
                ? "Loading..."
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
