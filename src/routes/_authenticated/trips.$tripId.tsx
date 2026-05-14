import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Plus, Trash2, Link2, BadgeCheck, Banknote, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({ component: TripDetail });

type Passenger = {
  id: string; name: string; phone: string | null; fare: number;
  payment_method: string; payment_status: string; linked_sms_id: string | null;
  sms?: { id: string; amount: number; upi_ref: string | null; sender_name: string | null; upi_id: string | null } | null;
};
type Trip = { id: string; name: string; trip_date: string; trip_time: string | null; base_fare: number; notes: string | null };
type SmsMsg = { id: string; amount: number; upi_ref: string | null; upi_id: string | null; sender_name: string | null; bank_to: string | null; bank_from: string | null; from_number: string | null; received_at: string; text: string };

function notify(msg: string, isError = false) {
  // Simple toast fallback (avoids sonner dep issue)
  if (typeof window !== "undefined") {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${isError?"#ef4444":"#22c55e"};color:#fff;padding:10px 20px;border-radius:12px;z-index:9999;font-size:14px;font-weight:600`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
}

function json200(res: Response) { if (!res.ok) throw new Error("API error"); return res.json(); }

function TripDetail() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fare, setFare] = useState("");
  const [method, setMethod] = useState<"cash" | "upi" | "pending">("cash");
  const [linkFor, setLinkFor] = useState<{ id: string; fare: number } | null>(null);

  // Load trip + passengers
  const tripQ = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const d = await fetch(`/api/trips/${tripId}`, { credentials: "include" }).then(json200);
      // Merge SMS data into passengers
      const passengers: Passenger[] = await Promise.all(
        (d.passengers as Passenger[]).map(async (p) => {
          if (!p.linked_sms_id) return p;
          // Try to get SMS details from the messages list (cached)
          return p;
        })
      );
      return { trip: d.trip as Trip, passengers };
    },
    enabled: !!user,
  });

  // Unlinked SMS for link picker
  const unlinkedSmsQ = useQuery({
    queryKey: ["unlinked-sms", linkFor?.id],
    enabled: !!linkFor,
    queryFn: async () => {
      const d = await fetch("/api/sms-messages/?linked=false", { credentials: "include" }).then(json200);
      return d.messages as SmsMsg[];
    },
  });

  async function addPassenger(e: React.FormEvent) {
    e.preventDefault();
    const f = parseFloat(fare) || Number(tripQ.data?.trip.base_fare ?? 0);
    const res = await fetch("/api/passengers/", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trip_id: tripId, name, phone: phone || null, fare: f,
        payment_method: method === "pending" ? "cash" : method,
        payment_status: method === "pending" ? "pending" : "paid",
      }),
    });
    if (!res.ok) { notify("Failed to add passenger", true); return; }
    notify("Passenger added");
    setOpen(false); setName(""); setPhone(""); setFare(""); setMethod("cash");
    qc.invalidateQueries({ queryKey: ["trip", tripId] });
    qc.invalidateQueries({ queryKey: ["trips"] });
  }

  async function deletePax(id: string) {
    await fetch(`/api/passengers/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["trip", tripId] });
    qc.invalidateQueries({ queryKey: ["trips"] });
  }

  async function togglePaid(id: string, current: string) {
    const next = current === "paid" ? "pending" : "paid";
    await fetch(`/api/passengers/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payment_status: next }),
    });
    qc.invalidateQueries({ queryKey: ["trip", tripId] });
  }

  async function linkSms(smsId: string) {
    if (!linkFor) return;
    await fetch("/api/sms-messages/", {
      method: "PATCH", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sms_id: smsId, passenger_id: linkFor.id }),
    });
    notify("SMS linked");
    setLinkFor(null);
    qc.invalidateQueries({ queryKey: ["trip", tripId] });
  }

  async function unlinkSms(passengerId: string, smsId: string) {
    await fetch("/api/sms-messages/", {
      method: "PATCH", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sms_id: smsId, passenger_id: null }),
    });
    await fetch(`/api/passengers/${passengerId}`, {
      method: "PATCH", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linked_sms_id: null }),
    });
    qc.invalidateQueries({ queryKey: ["trip", tripId] });
  }

  async function deleteTrip() {
    if (!confirm("Delete this trip and all passengers?")) return;
    await fetch(`/api/trips/${tripId}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["trips"] });
    navigate({ to: "/trips" });
  }

  const pax = tripQ.data?.passengers ?? [];
  const collected = pax.filter(p => p.payment_status === "paid").reduce((s, p) => s + Number(p.fare), 0);
  const pending = pax.filter(p => p.payment_status !== "paid").reduce((s, p) => s + Number(p.fare), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="size-4" />Back to trips
        </Link>
        <button onClick={deleteTrip} className="text-destructive text-sm flex items-center gap-1 hover:opacity-80 transition">
          <Trash2 className="size-4" />Delete trip
        </button>
      </div>

      {tripQ.data?.trip && (
        <div className="rounded-3xl bg-[image:var(--gradient-hero)] text-primary-foreground p-5 shadow-[var(--shadow-elevated)]">
          <p className="text-xs uppercase tracking-wider opacity-80">
            {tripQ.data.trip.trip_date}{tripQ.data.trip.trip_time ? ` · ${tripQ.data.trip.trip_time.slice(0,5)}` : ""}
          </p>
          <h2 className="font-display text-2xl font-semibold mt-1">{tripQ.data.trip.name}</h2>
          <div className="flex gap-4 mt-3 text-sm">
            <span>Base ₹{Number(tripQ.data.trip.base_fare).toLocaleString("en-IN")}</span>
            <span className="opacity-85">Collected ₹{collected.toLocaleString("en-IN")}</span>
            {pending > 0 && <span className="opacity-85">Pending ₹{pending.toLocaleString("en-IN")}</span>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Passengers ({pax.length})</h3>
        <button
          onClick={() => { setFare(String(tripQ.data?.trip.base_fare ?? "")); setOpen(true); }}
          className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-primary text-primary-foreground text-sm font-medium"
        ><Plus className="size-4" />Add</button>
      </div>

      <ul className="space-y-2.5">
        {pax.map((p) => (
          <li key={p.id} className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <div className={`size-10 rounded-xl grid place-items-center ${
                p.payment_method === "upi" ? "bg-accent/15 text-accent" : "bg-secondary text-secondary-foreground"
              }`}>
                {p.payment_method === "upi" ? <Smartphone className="size-5" /> : <Banknote className="size-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.phone || "—"} · {p.payment_method.toUpperCase()}</p>
                {p.linked_sms_id && (
                  <div className="text-[11px] mt-1.5 bg-accent/10 text-accent p-2 rounded-lg border border-accent/20">
                    <p className="flex items-center gap-1 font-medium"><Link2 className="size-3" /> Linked SMS</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="font-display font-semibold">₹{Number(p.fare).toLocaleString("en-IN")}</p>
                <button
                  onClick={() => togglePaid(p.id, p.payment_status)}
                  className={`mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    p.payment_status === "paid" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                  }`}
                >{p.payment_status === "paid" ? <span className="inline-flex items-center gap-1"><BadgeCheck className="size-3" />Paid</span> : "Pending"}</button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              {p.linked_sms_id ? (
                <button onClick={() => unlinkSms(p.id, p.linked_sms_id!)} className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="size-3" />Unlink
                </button>
              ) : (
                <button onClick={() => setLinkFor({ id: p.id, fare: Number(p.fare) })} className="text-xs text-accent flex items-center gap-1">
                  <Link2 className="size-3" />Link SMS
                </button>
              )}
              <button onClick={() => deletePax(p.id)} className="text-xs text-destructive flex items-center gap-1">
                <Trash2 className="size-3" />Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Add passenger sheet */}
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={() => setOpen(false)}>
          <form
            onSubmit={addPassenger} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto bg-background rounded-t-3xl p-6 space-y-3 shadow-[var(--shadow-elevated)]"
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto" />
            <h3 className="font-display text-xl font-semibold">Add passenger</h3>
            <Input label="Name" value={name} onChange={setName} required />
            <Input label="Phone" value={phone} onChange={setPhone} placeholder="Optional" />
            <Input label="Fare (₹)" type="number" value={fare} onChange={setFare} required />
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment</span>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(["cash","upi","pending"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => setMethod(m)}
                    className={`h-11 rounded-xl text-sm font-medium border transition ${
                      method === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
                    }`}
                  >{m === "pending" ? "Pending" : m.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <button className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold mt-2">Add</button>
          </form>
        </div>
      )}

      {/* Link SMS sheet */}
      {linkFor && (
        <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={() => setLinkFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl mx-auto bg-background rounded-t-3xl p-6 space-y-3 shadow-[var(--shadow-elevated)] max-h-[80vh] overflow-y-auto">
            <div className="w-12 h-1 bg-border rounded-full mx-auto" />
            <h3 className="font-display text-xl font-semibold">Link a UPI SMS</h3>
            <p className="text-xs text-muted-foreground">Pick the payment SMS for this passenger (fare ₹{linkFor.fare}).</p>
            {unlinkedSmsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {unlinkedSmsQ.data?.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No unlinked UPI messages yet.</p>
            )}
            <ul className="space-y-2">
              {unlinkedSmsQ.data?.map((s) => (
                <li key={s.id}>
                  <button onClick={() => linkSms(s.id)}
                    className="w-full text-left rounded-2xl bg-card border border-border p-3 hover:border-accent transition">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">₹{Number(s.amount ?? 0).toLocaleString("en-IN")}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(s.received_at).toLocaleString()}</p>
                      </div>
                      {s.upi_ref && <span className="text-[10px] bg-secondary px-2 py-1 rounded-full text-secondary-foreground truncate max-w-[120px]">Ref: {s.upi_ref}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                      {(s.sender_name || s.upi_id) && <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">From: {s.sender_name || s.upi_id}</span>}
                      {s.from_number && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">Sender: {s.from_number}</span>}
                      {s.bank_to && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">To: {s.bank_to}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{s.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
