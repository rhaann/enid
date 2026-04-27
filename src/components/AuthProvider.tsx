"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthCtx = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signingOut: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  isAdmin: false,
  loading: true,
  signingOut: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  // Only one user exists (admin), so logged-in === admin.
  // Server-side requireAdmin() still validates the profile for security.
  const isAdmin = !!user;

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || signingOutRef.current) return;
      setUser(session?.user ?? null);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    signingOutRef.current = true;
    setSigningOut(true);
    setUser(null);

    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Best-effort
    }

    window.location.href = "/";
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signingOut, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
