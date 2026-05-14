import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/passengers/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { passengers } = await collections();
        const result = await passengers.insertOne({
          user_id: user.userId,
          trip_id: body.trip_id,
          name: body.name,
          phone: body.phone ?? null,
          fare: Number(body.fare ?? 0),
          payment_method: body.payment_method ?? "cash",
          payment_status: body.payment_status ?? "pending",
          linked_sms_id: null,
          created_at: new Date(),
        });

        return json({ id: result.insertedId.toString() }, 201);
      },
    },
  },
});
