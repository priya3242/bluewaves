import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/trips/$tripId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { trips, passengers } = await collections();
        const trip = await trips.findOne({ _id: new ObjectId(params.tripId), user_id: user.userId });
        if (!trip) return json({ error: "not found" }, 404);

        const paxList = await passengers.find({ trip_id: params.tripId }).sort({ created_at: 1 }).toArray();

        return json({
          trip: { ...trip, id: trip._id.toString() },
          passengers: paxList.map(p => ({ ...p, id: p._id.toString() })),
        });
      },

      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { trips } = await collections();
        await trips.updateOne(
          { _id: new ObjectId(params.tripId), user_id: user.userId },
          { $set: { ...body, updated_at: new Date() } }
        );
        return json({ ok: true });
      },

      DELETE: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { trips, passengers } = await collections();
        await passengers.deleteMany({ trip_id: params.tripId });
        await trips.deleteOne({ _id: new ObjectId(params.tripId), user_id: user.userId });
        return json({ ok: true });
      },
    },
  },
});
