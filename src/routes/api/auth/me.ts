import { createFileRoute } from "@tanstack/react-router";
import { getUserFromRequest } from "@/lib/jwt";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return new Response(JSON.stringify({ user: null }), { status: 200, headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify({ user }), { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  },
});
