import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Banknote, Smartphone, BadgeCheck, Clock, ChevronDown, ChevronUp, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type Range = "today" | "yesterday" | "month" | "custom";

function rangeBounds(r: Range, customDate: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (r === "today") return { from: fmt(today), to: fmt(today), label: "Today" };
  if (r === "yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: fmt(y), to: fmt(y), label: "Yesterday" };
  }
  if (r === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(first), to: fmt(today), label: "This month" };
  }
  return { from: customDate, to: customDate, label: customDate };
}

type PaxItem = { id: string; name: string; phone: string | null; fare: number; payment_method: string; payment_status: string };
type TripGroup = { trip: { id: string; name: string; trip_date: string; trip_time: string | null }; passengers: PaxItem[] };
type Analytics = {
  revenue: number; expense: number; profit: number; cash: number; upi: number; pending: number;
  trips: number; passengers: number; tripGroups: TripGroup[];
};

function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("today");
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));
  const [expandedTrips, setExpandedTrips] = useState<Record<string, boolean>>({});
  const { from, to, label } = rangeBounds(range, customDate);

  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["analytics", user?.userId, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/?from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    enabled: !!user,
  });

  function toggleTrip(id: string) {
    setExpandedTrips(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-5">
      {/* Range filters */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {(["today", "yesterday", "month", "custom"] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium transition ${
              range === r ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >{r === "month" ? "This month" : r[0].toUpperCase() + r.slice(1)}</button>
        ))}
      </div>
      {range === "custom" && (
        <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
          className="w-full h-11 px-4 rounded-xl bg-card border border-border" />
      )}

      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>

      {/* Hero profit card */}
      <div className="rounded-3xl bg-[image:var(--gradient-hero)] text-primary-foreground p-5 shadow-[var(--shadow-elevated)]">
        <p className="text-xs uppercase tracking-wider opacity-80">Net profit</p>
        <p className="font-display text-4xl font-semibold mt-1">₹{(data?.profit ?? 0).toLocaleString("en-IN")}</p>
        <div className="flex gap-4 mt-4 text-sm">
          <span className="flex items-center gap-1"><ArrowUpRight className="size-4" />₹{(data?.revenue ?? 0).toLocaleString("en-IN")}</span>
          <span className="flex items-center gap-1 opacity-90"><ArrowDownRight className="size-4" />₹{(data?.expense ?? 0).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Trips" value={data?.trips ?? 0} />
        <Stat label="Passengers" value={data?.passengers ?? 0} />
        <Stat label="Cash" value={`₹${(data?.cash ?? 0).toLocaleString("en-IN")}`} />
        <Stat label="UPI" value={`₹${(data?.upi ?? 0).toLocaleString("en-IN")}`} />
        <Stat label="Pending" value={`₹${(data?.pending ?? 0).toLocaleString("en-IN")}`} accent="warning" />
        <Stat label="Expenses" value={`₹${(data?.expense ?? 0).toLocaleString("en-IN")}`} accent="destructive" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center">Loading…</p>}

      {/* Passengers by trip */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="font-display text-lg font-semibold">Passengers — {label}</h3>
        </div>

        {(data?.tripGroups?.length ?? 0) === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-6">No passengers found for this period.</p>
        )}

        <div className="space-y-3">
          {data?.tripGroups?.map(({ trip, passengers }) => {
            const expanded = expandedTrips[trip.id] !== false;
            const collected = passengers.filter(p => p.payment_status === "paid").reduce((s, p) => s + Number(p.fare), 0);
            const pending = passengers.filter(p => p.payment_status !== "paid").reduce((s, p) => s + Number(p.fare), 0);

            return (
              <div key={trip.id} className="rounded-2xl bg-card border border-border shadow-[var(--shadow-soft)] overflow-hidden">
                <button onClick={() => toggleTrip(trip.id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="flex-1 min-w-0">
                    <Link to="/trips/$tripId" params={{ tripId: trip.id }}
                      onClick={e => e.stopPropagation()} className="font-semibold hover:text-primary transition">
                      {trip.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {trip.trip_date}{trip.trip_time ? ` · ${trip.trip_time.slice(0,5)}` : ""} · {passengers.length} pax
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-semibold text-sm">₹{collected.toLocaleString("en-IN")}</p>
                    {pending > 0 && <p className="text-[10px] text-warning-foreground">+₹{pending.toLocaleString("en-IN")} pending</p>}
                  </div>
                  {expanded ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {passengers.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`size-8 rounded-lg grid place-items-center shrink-0 ${
                          p.payment_method === "upi" ? "bg-accent/15 text-accent" : "bg-secondary text-secondary-foreground"
                        }`}>
                          {p.payment_method === "upi" ? <Smartphone className="size-4" /> : <Banknote className="size-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.phone || "—"} · {p.payment_method.toUpperCase()}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">₹{Number(p.fare).toLocaleString("en-IN")}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
                            p.payment_status === "paid" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                          }`}>
                            {p.payment_status === "paid" ? <><BadgeCheck className="size-3" />Paid</> : <><Clock className="size-3" />Pending</>}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-2 bg-secondary/50">
                      <p className="text-xs text-muted-foreground">Trip total</p>
                      <p className="text-sm font-bold">₹{(collected + pending).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: "warning" | "destructive" }) {
  const color = accent === "warning" ? "text-warning-foreground" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl bg-card p-4 border border-border shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="size-3" />{label}</div>
      <p className={`mt-1.5 font-display text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
