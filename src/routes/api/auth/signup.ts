import { createFileRoute } from "@tanstack/react-router";
import { collections } from "@/lib/mongodb";
import { signToken, authCookie } from "@/lib/jwt";
import bcrypt from "bcryptjs";

export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { email?: string; password?: string };
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { email, password } = body;
        if (!email || !password) return json({ error: "email and password required" }, 400);

        const { users } = await collections();
        const existing = await users.findOne({ email: email.toLowerCase() });
        if (existing) return json({ error: "email already in use" }, 409);

        const hash = await bcrypt.hash(password, 10);
        const result = await users.insertOne({
          email: email.toLowerCase(),
          password_hash: hash,
          created_at: new Date(),
        });

        const token = await signToken({ userId: result.insertedId.toString(), email: email.toLowerCase() });
        return new Response(JSON.stringify({ ok: true }), {
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
