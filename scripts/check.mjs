import { spawnSync } from "node:child_process";

const files = [
  "lib/bracket.js",
  "lib/tournament-data.js",
  "lib/env.js",
  "lib/http.js",
  "lib/supabase.js",
  "lib/auth.js",
  "lib/tournament-config.server.js",
  "lib/payments/paypal.js",
  "lib/payments/midtrans.js",
  "api/public-config.js",
  "api/state.js",
  "api/vote.js",
  "api/payments/create.js",
  "api/payments/status.js",
  "api/payments/paypal/return.js",
  "api/payments/paypal/cancel.js",
  "api/webhooks/midtrans.js",
  "scripts/dev-server.mjs",
  "app/main.js"
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("Syntax check passed.");
