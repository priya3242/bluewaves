import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Ship } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, signUp, user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav({ to: "/dashboard" }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fn = mode === "in" ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else if (mode === "up") toast.success("Account created. You're signed in.");
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-hero)] flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 text-primary-foreground">
        <div className="size-14 rounded-2xl bg-white/15 grid place-items-center mb-6">
          <Ship className="size-7" />
        </div>
        <h1 className="font-display text-4xl font-semibold leading-tight">Bluwaves</h1>
        <p className="mt-2 text-sm opacity-85">Sign in to manage your trips, passengers and payments.</p>
      </div>

      <div className="bg-background rounded-t-3xl px-6 pt-8 pb-10 shadow-[var(--shadow-elevated)]">
        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-full text-sm">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-full font-medium transition ${
                mode === m ? "bg-card text-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground"
              }`}
            >{m === "in" ? "Sign in" : "Create account"}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border focus:border-ring focus:bg-card outline-none transition"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border focus:border-ring focus:bg-card outline-none transition"
              placeholder="••••••••"
            />
          </Field>
          <button
            disabled={busy}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60 shadow-[var(--shadow-soft)]"
          >{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
