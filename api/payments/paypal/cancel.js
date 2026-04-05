import { getBaseUrl } from "../../../lib/env.js";
import { redirect, sendMethodNotAllowed } from "../../../lib/http.js";
import { getServiceClient } from "../../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  const paymentOrderId = String(req.query.payment_order_id || "").trim();

  if (paymentOrderId) {
    const service = getServiceClient();
    await service
      .from("payment_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", paymentOrderId)
      .neq("status", "paid");
  }

  return redirect(
    res,
    302,
    `${getBaseUrl(req)}/?payment=paypal-cancelled&payment_order_id=${paymentOrderId}`
  );
}
