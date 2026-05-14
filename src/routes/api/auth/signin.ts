import { createFileRoute } from "@tanstack/react-router";
import { collections } from "@/lib/mongodb";
import { signToken, authCookie } from "@/lib/jwt";
import bcrypt from "bcryptjs";

export const Route = createFileRoute("/api/auth/signin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { email?: string; password?: string };
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { email, password } = body;
        if (!email || !password) return json({ error: "email and password required" }, 400);

        const { users } = await collections();
        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) return json({ error: "invalid credentials" }, 401);

        const ok = await bcrypt.compare(password, user.password_hash as string);
        if (!ok) return json({ error: "invalid credentials" }, 401);

        const token = await signToken({ userId: user._id.toString(), email: user.email as string });
        return new Response(JSON.stringify({ ok: true, email: user.email }), {
          status: 200,
          headers: { "content-type": "application/json", "set-cookie": authCookie(token) },
        });
      },
    },
  },
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
