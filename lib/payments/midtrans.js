import crypto from "node:crypto";
import { getOptionalEnv, getRequiredEnv } from "../env.js";

function getMidtransServerKey() {
  return getRequiredEnv("MIDTRANS_SERVER_KEY");
}

function getMidtransSnapBase() {
  return getOptionalEnv(
    "MIDTRANS_SNAP_API_BASE",
    "https://app.sandbox.midtrans.com"
  );
}

function getMidtransApiBase() {
  return getOptionalEnv("MIDTRANS_API_BASE", "https://api.sandbox.midtrans.com");
}

function getBasicAuthHeader() {
  return `Basic ${Buffer.from(`${getMidtransServerKey()}:`).toString("base64")}`;
}

export function getMidtransQuote(credits) {
  const pricePerCredit = Number(getOptionalEnv("PRICE_PER_CREDIT_IDR", "2000"));
  return {
    amount: credits * pricePerCredit,
    currencyCode: "IDR"
  };
}

export function getMidtransEnabledPayments() {
  const raw = getOptionalEnv("MIDTRANS_ENABLED_PAYMENTS", "gopay");
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createMidtransSnapTransaction({
  paymentOrderId,
  credits,
  customer,
  finishUrl,
  pendingUrl,
  errorUrl
}) {
  const quote = getMidtransQuote(credits);
  const response = await fetch(`${getMidtransSnapBase()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: paymentOrderId,
        gross_amount: quote.amount
      },
      customer_details: {
        email: customer.email || undefined,
        first_name: customer.firstName || "Tournament",
        last_name: customer.lastName || "User"
      },
      enabled_payments: getMidtransEnabledPayments(),
      callbacks: {
        finish: finishUrl,
        pending: pendingUrl,
        error: errorUrl
      }
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error_messages?.join(", ") || "Failed to create Midtrans transaction");
  }

  return {
    providerOrderId: paymentOrderId,
    redirectUrl: payload.redirect_url,
    snapToken: payload.token,
    quote
  };
}

export async function getMidtransTransactionStatus(orderId) {
  const response = await fetch(`${getMidtransApiBase()}/v2/${orderId}/status`, {
    method: "GET",
    headers: {
      Authorization: getBasicAuthHeader(),
      Accept: "application/json"
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.status_message || "Failed to fetch Midtrans status");
  }

  return payload;
}

export function verifyMidtransSignature({
  orderId,
  statusCode,
  grossAmount,
  signatureKey
}) {
  const serverKey = getMidtransServerKey();
  const expected = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");

  return expected === signatureKey;
}

export function isMidtransSettled(payload) {
  const transactionStatus = String(payload?.transaction_status || "").toLowerCase();
  return transactionStatus === "settlement" || transactionStatus === "capture";
}
