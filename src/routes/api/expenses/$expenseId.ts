import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/expenses/$expenseId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { expenses } = await collections();
        await expenses.deleteOne({ _id: new ObjectId(params.expenseId), user_id: user.userId });
        return json({ ok: true });
      },
    },
  },
});
