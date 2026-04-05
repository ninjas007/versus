import { getOptionalEnv, getRequiredEnv } from "../lib/env.js";
import { sendJson, sendMethodNotAllowed } from "../lib/http.js";
import {
  DEFAULT_PRICE_PER_CREDIT_IDR,
  FREE_VOTES_PER_MATCH
} from "../lib/tournament-data.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  return sendJson(res, 200, {
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    supabaseAnonKey: getRequiredEnv("SUPABASE_ANON_KEY"),
    freeVotesPerMatch: FREE_VOTES_PER_MATCH,
    pricePerCreditIdr: Number(
      getOptionalEnv(
        "PRICE_PER_CREDIT_IDR",
        String(DEFAULT_PRICE_PER_CREDIT_IDR)
      )
    )
  });
}
