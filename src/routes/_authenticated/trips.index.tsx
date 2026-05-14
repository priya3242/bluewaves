import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Plus, ChevronRight, Ship } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trips/")({ component: TripsList });

function TripsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [baseFare, setBaseFare] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["trips", user?.userId],
    queryFn: async () => {
      const res = await fetch("/api/trips/", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load trips");
      const d = await res.json();
      return d.trips as Array<{
        id: string; name: string; trip_date: string; trip_time: string | null;
        base_fare: number; status: string; pax_count: number;
      }>;
    },
    enabled: !!user,
  });

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/trips/", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, trip_date: date, trip_time: time || null, base_fare: parseFloat(baseFare) || 0, notes: notes || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { alert(data.error); return; }
    qc.invalidateQueries({ queryKey: ["trips"] });
    setOpen(false); setName(""); setBaseFare(""); setNotes(""); setTime("");
    navigate({ to: "/trips/$tripId", params: { tripId: data.id } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Trips</h2>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-[var(--shadow-soft)]"
        ><Plus className="size-4" />New trip</button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Ship className="size-10 mx-auto opacity-50" />
          <p className="mt-2 text-sm">No trips yet. Tap "New trip".</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {data?.map((t) => (
          <li key={t.id}>
            <Link
              to="/trips/$tripId" params={{ tripId: t.id }}
              className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-soft)] active:scale-[0.99] transition"
            >
              <div className="size-11 rounded-xl bg-secondary grid place-items-center text-secondary-foreground">
                <Ship className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.trip_date}{t.trip_time ? ` · ${t.trip_time.slice(0,5)}` : ""} · {t.pax_count} pax
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] uppercase font-medium text-primary">
                  <span>Manage Trip & Add Pax</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold">₹{Number(t.base_fare).toLocaleString("en-IN")}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">base</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={() => setOpen(false)}>
          <form
            onSubmit={createTrip}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto bg-background rounded-t-3xl p-6 space-y-3 shadow-[var(--shadow-elevated)]"
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto" />
            <h3 className="font-display text-xl font-semibold">New trip</h3>
            <Input label="Trip name" value={name} onChange={setName} required placeholder="Morning ride" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" value={date} onChange={setDate} required />
              <Input label="Time" type="time" value={time} onChange={setTime} />
            </div>
            <Input label="Base fare (₹)" type="number" value={baseFare} onChange={setBaseFare} placeholder="0" />
            <Input label="Notes" value={notes} onChange={setNotes} placeholder="Optional" />
            <button disabled={busy} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold mt-2 disabled:opacity-60">
              {busy ? "Creating…" : "Create trip"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <input
        type={type} required={required} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 mt-1 px-4 rounded-xl bg-card border border-border focus:border-ring outline-none"
      />
    </label>
  );
}
