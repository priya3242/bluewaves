import { createFileRoute } from "@tanstack/react-router";
import { collections } from "@/lib/mongodb";
import { analyzeSms } from "@/lib/sms-analyzer";

// Public webhook for incoming SMS — only UPI/bank messages are stored.
// Auth: header `x-webhook-secret` or ?secret= query param

export const Route = createFileRoute("/api/public/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WEBHOOK_SECRET;
        const provided = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret");
        if (!secret || provided !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }

        let payload: Record<string, unknown>;
        try { payload = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
        }

        const text = String(payload.text ?? "");
        if (!text) return new Response(JSON.stringify({ error: "missing text" }), { status: 400 });

        const analysis = analyzeSms(JSON.stringify([payload]));

        // Only store UPI/bank messages
        if (analysis.transactions.length === 0) {
          return new Response(JSON.stringify({ ok: true, stored: false, reason: "not a UPI/bank message" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }

        const txn = analysis.transactions[0];
        const isIncome = txn.type === "INCOME";

        const { smsMessages } = await collections();
        const result = await smsMessages.insertOne({
          from_number: payload.from ? String(payload.from) : null,
          text,
          sent_stamp: payload.sentStamp ? Number(payload.sentStamp) : null,
          received_stamp: payload.receivedStamp ? Number(payload.receivedStamp) : null,
          sim: payload.sim ? String(payload.sim) : null,
          is_upi: true,
          amount: txn.amount,
          upi_ref: txn.reference ?? null,
          upi_id: txn.merchant ?? null,
          bank_from: isIncome ? null : txn.bankName ?? null,
          bank_to: isIncome ? txn.bankName ?? null : null,
          sender_name: txn.merchant ?? null,
          linked_passenger_id: null,
          received_at: new Date(Number(payload.receivedStamp) || Date.now()),
          created_at: new Date(),
          raw: payload,
        });

        return new Response(JSON.stringify({ ok: true, id: result.insertedId.toString(), parsed: txn }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
