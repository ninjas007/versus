import { getUserFromRequest, upsertProfileFromUser } from "../lib/auth.js";
import { sendJson, sendMethodNotAllowed } from "../lib/http.js";
import { getServiceClient } from "../lib/supabase.js";
import {
  buildRuntimeState,
  buildTotalsMap,
  buildUsageMap,
  getCategoryById,
  getPublicCategories
} from "../lib/tournament-data.js";
import { loadTournamentCategories } from "../lib/tournament-config.server.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  try {
    const categories = await loadTournamentCategories();
    const publicCategories = getPublicCategories(categories);
    const categoryId = String(req.query.category || "").trim();
    const category = getCategoryById(
      categories,
      categoryId || publicCategories[0]?.id
    );

    if (!category) {
      return sendJson(res, 400, {
        error: "INVALID_CATEGORY",
        message: "Kategori tidak ditemukan."
      });
    }

    const service = getServiceClient();
    const { data: totalRows, error: totalError } = await service
      .from("vote_totals")
      .select("category_id, match_id, team_id, total_votes")
      .eq("category_id", category.id);

    if (totalError) {
      throw totalError;
    }

    const totals = buildTotalsMap(totalRows);
    const runtime = buildRuntimeState(category, totals, new Date());
    const { user } = await getUserFromRequest(req);

    let userPayload = null;

    if (user) {
      await upsertProfileFromUser(user);

      const [{ data: usageRows, error: usageError }, { data: balanceData, error: balanceError }] =
        await Promise.all([
          service
            .from("match_vote_usage")
            .select("match_id, free_votes_used")
            .eq("user_id", user.id)
            .eq("category_id", category.id),
          service.rpc("get_credit_balance", {
            p_user_id: user.id
          })
        ]);

      if (usageError) {
        throw usageError;
      }

      if (balanceError) {
        throw balanceError;
      }

      userPayload = {
        id: user.id,
        email: user.email || null,
        displayName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          null,
        avatarUrl:
          user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        creditBalance: Number(balanceData || 0),
        usageByMatch: buildUsageMap(usageRows)
      };
    }

    return sendJson(res, 200, {
      categories: publicCategories,
      activeCategoryId: category.id,
      totals,
      runtime: {
        matches: runtime.matches.map((match) => ({
          matchId: match.matchId,
          roundIndex: match.roundIndex,
          gameIndex: match.gameIndex,
          status: match.status,
          schedule: match.schedule
            ? {
                start: match.schedule.start.toISOString(),
                end: match.schedule.end.toISOString()
              }
            : null
        }))
      },
      user: userPayload
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "STATE_LOAD_FAILED",
      message: error.message || "Gagal memuat state."
    });
  }
}
