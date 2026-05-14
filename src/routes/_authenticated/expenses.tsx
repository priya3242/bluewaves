import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Plus, Fuel, Utensils, Wrench, Package, Trash2 } from "lucide-react";

const CATS = [
  { key: "fuel", label: "Fuel", Icon: Fuel },
  { key: "food", label: "Food", Icon: Utensils },
  { key: "maintenance", label: "Maintenance", Icon: Wrench },
  { key: "other", label: "Other", Icon: Package },
] as const;

export const Route = createFileRoute("/_authenticated/expenses")({ component: Expenses });

type Expense = { id: string; category: string; amount: number; expense_date: string; description: string | null };

function Expenses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("fuel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");

  const { data: expenses } = useQuery({
    queryKey: ["expenses", user?.userId],
    queryFn: async () => {
      const res = await fetch("/api/expenses/", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load expenses");
      const d = await res.json();
      return d.expenses as Expense[];
    },
    enabled: !!user,
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/expenses/", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, amount: parseFloat(amount), expense_date: date, description: desc || null }),
    });
    if (!res.ok) { alert("Failed to save expense"); return; }
    setOpen(false); setAmount(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  }

  async function del(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  }

  const total = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Expenses</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-[var(--shadow-soft)]">
          <Plus className="size-4" />Add
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total (last 100)</p>
        <p className="font-display text-2xl font-semibold mt-1">₹{total.toLocaleString("en-IN")}</p>
      </div>

      <ul className="space-y-2.5">
        {expenses?.map((e) => {
          const cat = CATS.find((c) => c.key === e.category) ?? CATS[3];
          return (
            <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4">
              <div className="size-10 rounded-xl bg-secondary grid place-items-center text-secondary-foreground">
                <cat.Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{e.expense_date}{e.description ? ` · ${e.description}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold">₹{Number(e.amount).toLocaleString("en-IN")}</p>
                <button onClick={() => del(e.id)} className="text-[11px] text-destructive flex items-center gap-1 mt-1 ml-auto">
                  <Trash2 className="size-3" />Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={() => setOpen(false)}>
          <form onSubmit={add} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto bg-background rounded-t-3xl p-6 space-y-3 shadow-[var(--shadow-elevated)]">
            <div className="w-12 h-1 bg-border rounded-full mx-auto" />
            <h3 className="font-display text-xl font-semibold">New expense</h3>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</span>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {CATS.map(({ key, label, Icon }) => (
                  <button type="button" key={key} onClick={() => setCategory(key)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs transition ${
                      category === key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
                    }`}>
                    <Icon className="size-4" />{label}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Amount (₹)" type="number" value={amount} onChange={setAmount} required />
            <Input label="Date" type="date" value={date} onChange={setDate} required />
            <Input label="Description" value={desc} onChange={setDesc} placeholder="Optional" />
            <button className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold mt-2">Save</button>
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
      <input type={type} required={required} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 mt-1 px-4 rounded-xl bg-card border border-border focus:border-ring outline-none" />
    </label>
  );
}
