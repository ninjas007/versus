import { getBaseUrl } from "../../../lib/env.js";
import { redirect, sendJson, sendMethodNotAllowed } from "../../../lib/http.js";
import { capturePayPalOrder } from "../../../lib/payments/paypal.js";
import { getServiceClient } from "../../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  const paymentOrderId = String(req.query.payment_order_id || "").trim();
  const paypalOrderId = String(req.query.token || "").trim();

  if (!paymentOrderId || !paypalOrderId) {
    return sendJson(res, 400, {
      error: "INVALID_PAYPAL_RETURN",
      message: "Data return PayPal tidak lengkap."
    });
  }

  try {
    const service = getServiceClient();
    const { data: paymentOrder } = await service
      .from("payment_orders")
      .select("id, status")
      .eq("id", paymentOrderId)
      .single();

    if (paymentOrder?.status === "paid") {
      return redirect(
        res,
        302,
        `${getBaseUrl(req)}/?payment=paypal-success&payment_order_id=${paymentOrderId}`
      );
    }

    const captureResult = await capturePayPalOrder(paypalOrderId);

    const { error } = await service.rpc("complete_payment", {
      p_payment_order_id: paymentOrderId,
      p_external_order_id: paypalOrderId,
      p_metadata: {
        paypal_status: captureResult.status
      }
    });

    if (error) {
      throw error;
    }

    return redirect(
      res,
      302,
      `${getBaseUrl(req)}/?payment=paypal-success&payment_order_id=${paymentOrderId}`
    );
  } catch (error) {
    return redirect(
      res,
      302,
      `${getBaseUrl(req)}/?payment=paypal-error&payment_order_id=${paymentOrderId}&message=${encodeURIComponent(
        error.message || "PayPal capture failed"
      )}`
    );
  }
}
