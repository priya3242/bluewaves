import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/sms-messages/")({
  server: {
    handlers: {
      // GET unlinked UPI SMS (for the link-SMS picker)
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const url = new URL(request.url);
        const linked = url.searchParams.get("linked"); // "false" = unlinked only

        const { smsMessages } = await collections();
        const filter: Record<string, unknown> = { is_upi: true };
        if (linked === "false") filter.linked_passenger_id = null;

        const msgs = await smsMessages.find(filter)
          .sort({ received_at: -1 })
          .limit(100)
          .toArray();

        return json({
          messages: msgs.map(m => ({
            id: m._id.toString(),
            amount: m.amount,
            upi_ref: m.upi_ref,
            upi_id: m.upi_id,
            sender_name: m.sender_name,
            bank_to: m.bank_to,
            bank_from: m.bank_from,
            from_number: m.from_number,
            received_at: m.received_at,
            text: m.text,
            linked_passenger_id: m.linked_passenger_id ?? null,
          })),
        });
      },

      // PATCH: link/unlink an SMS to a passenger
      PATCH: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        let body: { sms_id?: string; passenger_id?: string | null };
        try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

        const { smsMessages, passengers } = await collections();

        // Unlink if passenger_id is null
        if (body.passenger_id === null && body.sms_id) {
          await smsMessages.updateOne(
            { _id: new ObjectId(body.sms_id) },
            { $set: { linked_passenger_id: null } }
          );
          return json({ ok: true });
        }

        if (!body.sms_id || !body.passenger_id) return json({ error: "missing fields" }, 400);

        // Get SMS to read amount
        const sms = await smsMessages.findOne({ _id: new ObjectId(body.sms_id) });
        if (!sms) return json({ error: "sms not found" }, 404);

        await smsMessages.updateOne(
          { _id: new ObjectId(body.sms_id) },
          { $set: { linked_passenger_id: body.passenger_id } }
        );
        await passengers.updateOne(
          { _id: new ObjectId(body.passenger_id) },
          { $set: { linked_sms_id: body.sms_id, payment_method: "upi", payment_status: "paid", ...(sms.amount ? { fare: sms.amount } : {}) } }
        );

        return json({ ok: true });
      },
    },
  },
});
