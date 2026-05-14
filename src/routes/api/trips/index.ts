import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/trips/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { trips, passengers } = await collections();
        const tripList = await trips.find({ user_id: user.userId }).sort({ trip_date: -1, _id: -1 }).toArray();

        // Get passenger counts per trip
        const tripIds = tripList.map(t => t._id.toString());
        const paxCounts = await passengers.aggregate([
          { $match: { trip_id: { $in: tripIds } } },
          { $group: { _id: "$trip_id", count: { $sum: 1 } } }
        ]).toArray();
        const countMap: Record<string, number> = {};
        paxCounts.forEach(p => { countMap[p._id] = p.count; });

        const result = tripList.map(t => ({
          id: t._id.toString(),
          name: t.name,
          trip_date: t.trip_date,
          trip_time: t.trip_time,
          base_fare: t.base_fare,
          status: t.status ?? "active",
          notes: t.notes,
          pax_count: countMap[t._id.toString()] ?? 0,
        }));

        return json({ trips: result });
      },

      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { trips } = await collections();
        const result = await trips.insertOne({
          user_id: user.userId,
          name: body.name,
          trip_date: body.trip_date,
          trip_time: body.trip_time ?? null,
          base_fare: Number(body.base_fare ?? 0),
          notes: body.notes ?? null,
          status: "active",
          created_at: new Date(),
        });

        return json({ id: result.insertedId.toString() }, 201);
      },
    },
  },
});
