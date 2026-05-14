import { createFileRoute } from "@tanstack/react-router";
import { collections, ObjectId } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/jwt";

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/sms-messages/$smsId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const { smsMessages } = await collections();
        let msg;
        try {
          msg = await smsMessages.findOne({ _id: new ObjectId(params.smsId) });
        } catch {
          return json({ error: "invalid id" }, 400);
        }
        if (!msg) return json({ error: "not found" }, 404);

        return json({
          message: {
            id: msg._id.toString(),
            amount: msg.amount,
            upi_ref: msg.upi_ref ?? null,
            upi_id: msg.upi_id ?? null,
            sender_name: msg.sender_name ?? null,
            bank_to: msg.bank_to ?? null,
            bank_from: msg.bank_from ?? null,
            from_number: msg.from_number ?? null,
            received_at: msg.received_at,
            text: msg.text,
            is_upi: msg.is_upi ?? false,
            linked_passenger_id: msg.linked_passenger_id ?? null,
          },
        });
      },
    },
  },
});
