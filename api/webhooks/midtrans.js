import { sendJson, sendMethodNotAllowed, readJson } from "../../lib/http.js";
import {
  isMidtransSettled,
  verifyMidtransSignature
} from "../../lib/payments/midtrans.js";
import { getServiceClient } from "../../lib/supabase.js";

function mapMidtransStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "pending") return "pending";
  if (["cancel", "expire", "deny"].includes(normalized)) return "cancelled";
  return "failed";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, ["POST"]);
  }

  try {
    const payload = await readJson(req);
    const orderId = String(payload.order_id || "").trim();
    const statusCode = String(payload.status_code || "").trim();
    const grossAmount = String(payload.gross_amount || "").trim();
    const signatureKey = String(payload.signature_key || "").trim();

    if (!orderId || !signatureKey) {
      return sendJson(res, 400, {
        error: "INVALID_MIDTRANS_WEBHOOK",
        message: "Payload webhook tidak lengkap."
      });
    }

    const isValid = verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      signatureKey
    });

    if (!isValid) {
      return sendJson(res, 401, {
        error: "INVALID_SIGNATURE",
        message: "Signature Midtrans tidak valid."
      });
    }

    const service = getServiceClient();

    if (isMidtransSettled(payload)) {
      const { error } = await service.rpc("complete_payment", {
        p_payment_order_id: orderId,
        p_external_order_id: orderId,
        p_metadata: {
          transaction_status: payload.transaction_status,
          payment_type: payload.payment_type
        }
      });

      if (error) {
        throw error;
      }
    } else if (payload.transaction_status) {
      await service
        .from("payment_orders")
        .update({
          status: mapMidtransStatus(payload.transaction_status),
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId)
        .neq("status", "paid");
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, {
      error: "MIDTRANS_WEBHOOK_FAILED",
      message: error.message || "Webhook Midtrans gagal diproses."
    });
  }
}
