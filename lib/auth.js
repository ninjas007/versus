import { getAuthClient, getServiceClient } from "./supabase.js";

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== "string") {
    return "";
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

export async function getUserFromRequest(req) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return { user: null, accessToken: "" };
  }

  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data?.user) {
    return { user: null, accessToken };
  }

  return {
    user: data.user,
    accessToken
  };
}

export async function upsertProfileFromUser(user) {
  if (!user?.id) return null;

  const service = getServiceClient();
  const metadata = user.user_metadata || {};
  const fullName =
    metadata.full_name || metadata.name || metadata.user_name || null;
  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  const { error } = await service.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email || null,
      display_name: fullName,
      avatar_url: avatarUrl
    },
    {
      onConflict: "id"
    }
  );

  if (error) {
    throw error;
  }

  return {
    id: user.id,
    email: user.email || null,
    displayName: fullName,
    avatarUrl
  };
}
