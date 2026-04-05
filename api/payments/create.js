import { getUserFromRequest, upsertProfileFromUser } from "../../lib/auth.js";
import { getBaseUrl } from "../../lib/env.js";
import { sendJson, sendMethodNotAllowed, readJson } from "../../lib/http.js";
import { createMidtransSnapTransaction, getMidtransQuote } from "../../lib/payments/midtrans.js";
import { createPayPalOrder, getPayPalQuote } from "../../lib/payments/paypal.js";
import { getServiceClient } from "../../lib/supabase.js";

function normalizeCredits(value) {
  const credits = Math.max(1, Math.floor(Number(value) || 0));
  return Number.isFinite(credits) ? credits : 1;
}

function getQuoteForProvider(provider, credits) {
  return provider === "paypal"
    ? getPayPalQuote(credits)
    : {
        amount: String(getMidtransQuote(credits).amount),
        currencyCode: getMidtransQuote(credits).currencyCode
      };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, ["POST"]);
  }

  const { user } = await getUserFromRequest(req);

  if (!user) {
    return sendJson(res, 401, {
      error: "UNAUTHORIZED",
      message: "Login Google dulu sebelum membuat pembayaran."
    });
  }

  try {
    const body = await readJson(req);
    const provider = String(body.provider || "").trim().toLowerCase();
    const credits = normalizeCredits(body.credits);

    if (!["paypal", "qris"].includes(provider)) {
      return sendJson(res, 400, {
        error: "INVALID_PROVIDER",
        message: "Provider pembayaran tidak valid."
      });
    }

    await upsertProfileFromUser(user);

    const service = getServiceClient();
    const quote = getQuoteForProvider(provider, credits);

    const { data: orderRow, error: orderError } = await service
      .from("payment_orders")
      .insert({
        user_id: user.id,
        provider,
        status: "pending",
        credits_to_grant: credits,
        amount_major: quote.amount,
        currency_code: quote.currencyCode,
        metadata: body.pendingVote ? { pendingVote: body.pendingVote } : {}
      })
      .select("*")
      .single();

    if (orderError) {
      throw orderError;
    }

    const baseUrl = getBaseUrl(req);

    if (provider === "paypal") {
      const payment = await createPayPalOrder({
        paymentOrderId: orderRow.id,
        credits,
        description: `${credits} vote credit`,
        returnUrl: `${baseUrl}/api/payments/paypal/return?payment_order_id=${orderRow.id}`,
        cancelUrl: `${baseUrl}/api/payments/paypal/cancel?payment_order_id=${orderRow.id}`
      });

      const { error: updateError } = await service
        .from("payment_orders")
        .update({
          external_order_id: payment.providerOrderId,
          approval_url: payment.approvalUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderRow.id);

      if (updateError) {
        throw updateError;
      }

      return sendJson(res, 200, {
        ok: true,
        provider,
        paymentOrderId: orderRow.id,
        approvalUrl: payment.approvalUrl,
        quote: payment.quote
      });
    }

    const payment = await createMidtransSnapTransaction({
      paymentOrderId: orderRow.id,
      credits,
      customer: {
        email: user.email || undefined,
        firstName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "Tournament",
        lastName: "User"
      },
      finishUrl: `${baseUrl}/?payment=midtrans-finish&payment_order_id=${orderRow.id}`,
      pendingUrl: `${baseUrl}/?payment=midtrans-pending&payment_order_id=${orderRow.id}`,
      errorUrl: `${baseUrl}/?payment=midtrans-error&payment_order_id=${orderRow.id}`
    });

    const { error: updateError } = await service
      .from("payment_orders")
      .update({
        external_order_id: payment.providerOrderId,
        approval_url: payment.redirectUrl,
        metadata: {
          ...(orderRow.metadata || {}),
          snapToken: payment.snapToken
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", orderRow.id);

    if (updateError) {
      throw updateError;
    }

    return sendJson(res, 200, {
      ok: true,
      provider,
      paymentOrderId: orderRow.id,
      redirectUrl: payment.redirectUrl,
      snapToken: payment.snapToken,
      quote: payment.quote
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "PAYMENT_CREATE_FAILED",
      message: error.message || "Gagal membuat pembayaran."
    });
  }
}
