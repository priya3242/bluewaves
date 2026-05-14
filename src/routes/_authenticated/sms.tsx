import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { MessageSquareText, Link2, X, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sms")({ component: SmsInbox });

type SmsMsg = {
  id: string; amount: number; upi_ref: string | null; upi_id: string | null;
  sender_name: string | null; bank_to: string | null; from_number: string | null;
  received_at: string; text: string; linked_passenger_id: string | null;
};
type PendingPax = { id: string; name: string; fare: number; trip_name?: string; trip_date?: string };

function SmsInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [linking, setLinking] = useState<{ smsId: string; amount: number | null } | null>(null);

  const { data: msgs, isLoading } = useQuery({
    queryKey: ["sms", user?.userId],
    queryFn: async () => {
      const res = await fetch("/api/sms-messages/", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load SMS");
      const d = await res.json();
      return d.messages as SmsMsg[];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-semibold">UPI SMS Inbox</h2>
      <p className="text-xs text-muted-foreground">UPI/bank payment messages received via webhook. Tap "Link" to connect to a passenger.</p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {msgs?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquareText className="size-10 mx-auto opacity-50" />
          <p className="mt-2 text-sm">No UPI messages yet.</p>
          <p className="text-xs mt-1 opacity-70">Send a test via the Python script or your phone.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {msgs?.map((m) => (
          <li key={m.id} className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl font-semibold">₹{Number(m.amount ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {m.from_number || "—"} · {new Date(m.received_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              {m.linked_passenger_id ? (
                <span className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/15 text-success">
                  <BadgeCheck className="size-3" />Linked
                </span>
              ) : (
                <button onClick={() => setLinking({ smsId: m.id, amount: m.amount })}
                  className="text-[11px] inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground">
                  <Link2 className="size-3" />Link
                </button>
              )}
            </div>
            <p className="text-sm mt-2 leading-snug">{m.text}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
              {m.upi_ref && <Tag>Ref: {m.upi_ref}</Tag>}
              {m.upi_id && <Tag>{m.upi_id}</Tag>}
              {m.sender_name && <Tag>From: {m.sender_name}</Tag>}
              {m.bank_to && <Tag>To: {m.bank_to}</Tag>}
            </div>
          </li>
        ))}
      </ul>

      {linking && (
        <LinkSheet
          smsId={linking.smsId}
          amount={linking.amount}
          onClose={() => setLinking(null)}
          onLinked={() => { setLinking(null); qc.invalidateQueries({ queryKey: ["sms"] }); }}
        />
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{children}</span>;
}

function LinkSheet({ smsId, amount, onClose, onLinked }: {
  smsId: string; amount: number | null; onClose: () => void; onLinked: () => void;
}) {
  const { data: pending } = useQuery({
    queryKey: ["pending-pax"],
    queryFn: async () => {
      // Fetch all trips then passengers — a simple approach
      const res = await fetch("/api/sms-messages/?linked=false", { credentials: "include" });
      // Actually fetch analytics for all time to get pending passengers
      const now = new Date().toISOString().slice(0, 10);
      const start = "2020-01-01";
      const aRes = await fetch(`/api/analytics/?from=${start}&to=${now}`, { credentials: "include" });
      const d = await aRes.json();
      const allPax: PendingPax[] = [];
      for (const g of d.tripGroups ?? []) {
        for (const p of g.passengers) {
          if (p.payment_status !== "paid") {
            allPax.push({ id: p.id, name: p.name, fare: p.fare, trip_name: g.trip.name, trip_date: g.trip.trip_date });
          }
        }
      }
      return allPax;
    },
  });

  async function link(passengerId: string) {
    await fetch("/api/sms-messages/", {
      method: "PATCH", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sms_id: smsId, passenger_id: passengerId }),
    });
    onLinked();
  }

  return (
    <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl mx-auto bg-background rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto shadow-[var(--shadow-elevated)]">
        <div className="w-12 h-1 bg-border rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl font-semibold">Link to passenger</h3>
          <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
        </div>
        {amount && <p className="text-sm text-muted-foreground mb-3">Amount: ₹{Number(amount).toLocaleString("en-IN")}</p>}
        <ul className="space-y-2">
          {pending?.length === 0 && <li className="text-sm text-muted-foreground text-center py-6">No pending passengers.</li>}
          {pending?.map((p) => (
            <li key={p.id}>
              <button onClick={() => link(p.id)} className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border hover:border-ring transition">
                <div className="text-left">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.trip_name} · {p.trip_date}</p>
                </div>
                <p className="font-display font-semibold">₹{Number(p.fare).toLocaleString("en-IN")}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
