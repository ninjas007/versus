import { getUserFromRequest } from "../../lib/auth.js";
import { sendJson, sendMethodNotAllowed } from "../../lib/http.js";
import { getMidtransTransactionStatus, isMidtransSettled } from "../../lib/payments/midtrans.js";
import { getServiceClient } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  const { user } = await getUserFromRequest(req);

  if (!user) {
    return sendJson(res, 401, {
      error: "UNAUTHORIZED",
      message: "Login Google dulu."
    });
  }

  const paymentOrderId = String(req.query.id || "").trim();

  if (!paymentOrderId) {
    return sendJson(res, 400, {
      error: "INVALID_PAYMENT_ID",
      message: "Payment order id wajib diisi."
    });
  }

  try {
    const service = getServiceClient();
    const { data: paymentOrder, error: paymentError } = await service
      .from("payment_orders")
      .select("*")
      .eq("id", paymentOrderId)
      .eq("user_id", user.id)
      .single();

    if (paymentError) {
      throw paymentError;
    }

    let status = paymentOrder.status;

    if (paymentOrder.provider === "qris" && paymentOrder.status !== "paid") {
      const remoteStatus = await getMidtransTransactionStatus(paymentOrder.id);

      if (isMidtransSettled(remoteStatus)) {
        const { error: completeError } = await service.rpc("complete_payment", {
          p_payment_order_id: paymentOrder.id,
          p_external_order_id: remoteStatus.order_id,
          p_metadata: {
            transaction_status: remoteStatus.transaction_status,
            payment_type: remoteStatus.payment_type
          }
        });

        if (completeError) {
          throw completeError;
        }

        status = "paid";
      } else if (remoteStatus.transaction_status) {
        status = String(remoteStatus.transaction_status).toLowerCase();
      }
    }

    const { data: balanceData, error: balanceError } = await service.rpc("get_credit_balance", {
      p_user_id: user.id
    });

    if (balanceError) {
      throw balanceError;
    }

    return sendJson(res, 200, {
      ok: true,
      paymentOrderId: paymentOrder.id,
      provider: paymentOrder.provider,
      status,
      creditBalance: Number(balanceData || 0)
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "PAYMENT_STATUS_FAILED",
      message: error.message || "Gagal memeriksa status pembayaran."
    });
  }
}
