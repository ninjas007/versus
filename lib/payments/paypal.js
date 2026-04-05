import { getOptionalEnv, getRequiredEnv } from "../env.js";

async function fetchPayPalAccessToken() {
  const clientId = getRequiredEnv("PAYPAL_CLIENT_ID");
  const clientSecret = getRequiredEnv("PAYPAL_CLIENT_SECRET");
  const apiBase = getOptionalEnv(
    "PAYPAL_API_BASE",
    "https://api-m.sandbox.paypal.com"
  );
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error_description || "Failed to get PayPal token");
  }

  return payload.access_token;
}

export function getPayPalQuote(credits) {
  const unitAmount = Number(getOptionalEnv("PAYPAL_USD_PER_CREDIT", "0.25"));
  const value = (unitAmount * credits).toFixed(2);
  return {
    amount: value,
    currencyCode: "USD"
  };
}

export async function createPayPalOrder({
  paymentOrderId,
  credits,
  description,
  returnUrl,
  cancelUrl
}) {
  const apiBase = getOptionalEnv(
    "PAYPAL_API_BASE",
    "https://api-m.sandbox.paypal.com"
  );
  const accessToken = await fetchPayPalAccessToken();
  const quote = getPayPalQuote(credits);

  const response = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: paymentOrderId,
          description,
          amount: {
            currency_code: quote.currencyCode,
            value: quote.amount
          }
        }
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: "PAY_NOW"
      }
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to create PayPal order");
  }

  const approveLink = payload?.links?.find((link) => link.rel === "approve");

  return {
    providerOrderId: payload.id,
    approvalUrl: approveLink?.href || null,
    quote
  };
}

export async function capturePayPalOrder(orderId) {
  const apiBase = getOptionalEnv(
    "PAYPAL_API_BASE",
    "https://api-m.sandbox.paypal.com"
  );
  const accessToken = await fetchPayPalAccessToken();

  const response = await fetch(`${apiBase}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to capture PayPal order");
  }

  return payload;
}
