"use client";

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type AuthUser = {
  id: string;
  username: string;
  firstName?: string;
  fullName?: string;
  imageUrl?: string;
  emailAddresses: Array<{ emailAddress: string }>;
};

type SessionResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    displayName?: string | null;
  };
  convexToken?: string;
};

type AuthContextValue = {
  loading: boolean;
  user: AuthUser | null;
  refreshSession: () => Promise<SessionResponse | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<SessionResponse | null> {
  const res = await fetch("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as SessionResponse;
}

function normalizeAuthUser(
  user: SessionResponse["user"] | undefined
): AuthUser | null {
  if (!user) return null;
  const fullName = user.displayName || user.username;
  return {
    id: user.id,
    username: user.username,
    firstName: fullName.split(" ")[0],
    fullName,
    emailAddresses: [{ emailAddress: user.email }],
  };
}

export function YouAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSession();
      setUser(normalizeAuthUser(data?.user));
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    router.push("/sign-in");
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ loading, user, refreshSession, signOut }),
    [loading, user, refreshSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("YouAuthProvider is missing from the React tree.");
  }
  return context;
}

export function useUser() {
  const { loading, user } = useAuthContext();
  return {
    isLoaded: !loading,
    isSignedIn: !!user,
    user,
  };
}

export function useSessionAuth() {
  const { signOut } = useAuthContext();
  return {
    signOut,
    loaded: true,
  };
}

export const useClerk = useSessionAuth;

export function useAuth() {
  const { loading, user } = useAuthContext();
  const fetchAccessToken = useCallback(async () => {
    const data = await fetchSession();
    return data?.convexToken ?? null;
  }, []);
  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken]
  );
}

export function SignOutButton({ children }: { children: ReactNode }) {
  const { signOut } = useSessionAuth();

  if (!children || typeof children !== "object") {
    return (
      <button type="button" onClick={() => void signOut()}>
        {children}
      </button>
    );
  }

  const child = children as React.ReactElement<{ onClick?: () => void }>;
  return cloneElement(child, {
    ...child.props,
    onClick: async () => {
      child.props.onClick?.();
      await signOut();
    },
  });
}
