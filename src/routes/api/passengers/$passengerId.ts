import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/passengers/$passengerId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { passengers } = await collections();
        await passengers.updateOne(
          { _id: new ObjectId(params.passengerId), user_id: user.userId },
          { $set: { ...body, updated_at: new Date() } }
        );
        return json({ ok: true });
      },

      DELETE: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { passengers } = await collections();
        await passengers.deleteOne({ _id: new ObjectId(params.passengerId), user_id: user.userId });
        return json({ ok: true });
      },
    },
  },
});
