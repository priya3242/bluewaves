import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/expenses/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { expenses } = await collections();
        const list = await expenses.find({ user_id: user.userId })
          .sort({ expense_date: -1 })
          .limit(100)
          .toArray();

        return json({
          expenses: list.map(e => ({
            id: e._id.toString(),
            category: e.category,
            amount: e.amount,
            expense_date: e.expense_date,
            description: e.description ?? null,
          })),
        });
      },

      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { expenses } = await collections();
        const result = await expenses.insertOne({
          user_id: user.userId,
          category: body.category ?? "other",
          amount: Number(body.amount ?? 0),
          expense_date: body.expense_date,
          description: body.description ?? null,
          created_at: new Date(),
        });

        return json({ id: result.insertedId.toString() }, 201);
      },
    },
  },
});
