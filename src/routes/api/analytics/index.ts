import { createFileRoute } from "@tanstack/react-router";
import { collections } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/analytics/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const url = new URL(request.url);
        const from = url.searchParams.get("from")!;
        const to = url.searchParams.get("to")!;

        const { trips, passengers, expenses } = await collections();

        const tripList = await trips.find({
          user_id: user.userId,
          trip_date: { $gte: from, $lte: to },
        }).toArray();

        const tripIds = tripList.map(t => t._id.toString());

        const [paxList, expList] = await Promise.all([
          passengers.find({ trip_id: { $in: tripIds } }).toArray(),
          expenses.find({ user_id: user.userId, expense_date: { $gte: from, $lte: to } }).toArray(),
        ]);

        const paxRevenue = paxList.reduce((s, p) => s + Number(p.fare ?? 0), 0);
        const cash = paxList.filter(p => p.payment_method === "cash" && p.payment_status === "paid").reduce((s, p) => s + Number(p.fare ?? 0), 0);
        const upi = paxList.filter(p => p.payment_method === "upi" && p.payment_status === "paid").reduce((s, p) => s + Number(p.fare ?? 0), 0);
        const pending = paxList.filter(p => p.payment_status !== "paid").reduce((s, p) => s + Number(p.fare ?? 0), 0);
        const expense = expList.reduce((s, e) => s + Number(e.amount ?? 0), 0);

        // Group passengers by trip for the report
        const byTrip: Record<string, { trip: Record<string, unknown>; passengers: typeof paxList }> = {};
        tripList.forEach(t => {
          byTrip[t._id.toString()] = {
            trip: { id: t._id.toString(), name: t.name, trip_date: t.trip_date, trip_time: t.trip_time },
            passengers: [],
          };
        });
        paxList.forEach(p => {
          const tid = p.trip_id as string;
          if (byTrip[tid]) {
            byTrip[tid].passengers.push(p);
          }
        });

        return json({
          revenue: paxRevenue,
          expense,
          profit: paxRevenue - expense,
          cash,
          upi,
          pending,
          trips: tripList.length,
          passengers: paxList.length,
          tripGroups: Object.values(byTrip)
            .sort((a, b) => String(b.trip.trip_date).localeCompare(String(a.trip.trip_date)))
            .map(g => ({
              trip: g.trip,
              passengers: g.passengers.map(p => ({
                id: p._id.toString(),
                name: p.name,
                phone: p.phone ?? null,
                fare: p.fare,
                payment_method: p.payment_method,
                payment_status: p.payment_status,
                linked_sms_id: p.linked_sms_id ?? null,
              })),
            })),
        });
      },
    },
  },
});
