import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthUser {
  userId: string;
  email: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setUser(d.user ?? null); })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Sign in failed" };
    setUser({ userId: "", email }); // Will be refreshed on next /me call
    // Re-fetch to get full user
    const me = await fetch("/api/auth/me", { credentials: "include" }).then(r => r.json());
    setUser(me.user ?? null);
    return { error: null };
  };

  const signUp: AuthCtx["signUp"] = async (email, password) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Sign up failed" };
    const me = await fetch("/api/auth/me", { credentials: "include" }).then(r => r.json());
    setUser(me.user ?? null);
    return { error: null };
  };

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
