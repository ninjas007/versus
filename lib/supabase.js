import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "./env.js";

let serviceClient;
let authClient;

function getUrl() {
  return getRequiredEnv("SUPABASE_URL");
}

function getAnonKey() {
  return getRequiredEnv("SUPABASE_ANON_KEY");
}

function getServiceRoleKey() {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getAuthClient() {
  if (!authClient) {
    authClient = createClient(getUrl(), getAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return authClient;
}

export function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(getUrl(), getServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return serviceClient;
}
