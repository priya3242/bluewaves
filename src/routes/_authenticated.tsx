import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({ component: Guard });

function Guard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" />;
  return <AppLayout />;
}
