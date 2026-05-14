import { createFileRoute } from "@tanstack/react-router";
import { clearCookie } from "@/lib/jwt";

export const Route = createFileRoute("/api/auth/signout")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json", "set-cookie": clearCookie() },
        });
      },
    },
  },
});
