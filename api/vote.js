import { getUserFromRequest, upsertProfileFromUser } from "../lib/auth.js";
import { sendJson, sendMethodNotAllowed, readJson } from "../lib/http.js";
import { getServiceClient } from "../lib/supabase.js";
import {
  buildRuntimeState,
  buildTotalsMap,
  getCategoryById,
  teamKey,
  validateMatchSelection
} from "../lib/tournament-data.js";

function normalizeQuantity(value) {
  const quantity = Math.max(1, Math.floor(Number(value) || 0));
  return Number.isFinite(quantity) ? quantity : 1;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, ["POST"]);
  }

  const { user } = await getUserFromRequest(req);

  if (!user) {
    return sendJson(res, 401, {
      error: "UNAUTHORIZED",
      message: "Login Google dulu sebelum vote."
    });
  }

  try {
    const body = await readJson(req);
    const categoryId = String(body.categoryId || "").trim();
    const matchId = String(body.matchId || "").trim();
    const teamId = String(body.teamId || "").trim().toLowerCase();
    const quantity = normalizeQuantity(body.quantity);

    if (!getCategoryById(categoryId)) {
      return sendJson(res, 400, {
        error: "INVALID_CATEGORY",
        message: "Kategori tidak ditemukan."
      });
    }

    const service = getServiceClient();
    const { data: totalRows, error: totalError } = await service
      .from("vote_totals")
      .select("category_id, match_id, team_id, total_votes")
      .eq("category_id", categoryId);

    if (totalError) {
      throw totalError;
    }

    const totals = buildTotalsMap(totalRows);
    const validation = validateMatchSelection(categoryId, totals, matchId, teamId, new Date());

    if (!validation.ok) {
      return sendJson(res, 400, {
        error: validation.code,
        message: validation.message
      });
    }

    await upsertProfileFromUser(user);

    const { data: voteResult, error: voteError } = await service.rpc("cast_vote", {
      p_user_id: user.id,
      p_category_id: categoryId,
      p_match_id: matchId,
      p_team_id: teamId,
      p_quantity: quantity
    });

    if (voteError) {
      throw voteError;
    }

    if (!voteResult?.ok && voteResult?.code === "PAYMENT_REQUIRED") {
      return sendJson(res, 402, {
        error: "PAYMENT_REQUIRED",
        message: "Vote gratis untuk match ini sudah habis. Beli credit dulu ya.",
        freeVotesRemaining: Number(voteResult.free_votes_remaining || 0),
        paidVotesNeeded: Number(voteResult.paid_votes_needed || 0),
        creditBalance: Number(voteResult.credit_balance || 0),
        missingCredits: Number(voteResult.missing_credits || 0)
      });
    }

    const [{ data: newTotalRows, error: newTotalError }, { data: balanceData, error: balanceError }] =
      await Promise.all([
        service
          .from("vote_totals")
          .select("category_id, match_id, team_id, total_votes")
          .eq("category_id", categoryId),
        service.rpc("get_credit_balance", {
          p_user_id: user.id
        })
      ]);

    if (newTotalError) {
      throw newTotalError;
    }

    if (balanceError) {
      throw balanceError;
    }

    const refreshedTotals = buildTotalsMap(newTotalRows);
    const runtime = buildRuntimeState(categoryId, refreshedTotals, new Date());
    const updatedMatch =
      runtime.matches.find((item) => item.matchId === matchId) || validation.match;

    return sendJson(res, 200, {
      ok: true,
      matchId,
      teamId,
      quantity,
      totals: refreshedTotals,
      user: {
        creditBalance: Number(balanceData || 0),
        usageByMatch: {
          [matchId]: {
            freeVotesUsed: 1 - Number(voteResult.free_votes_remaining || 0),
            freeVotesRemaining: Number(voteResult.free_votes_remaining || 0)
          }
        }
      },
      match: {
        matchId: updatedMatch.matchId,
        roundIndex: updatedMatch.roundIndex,
        gameIndex: updatedMatch.gameIndex,
        rawTotals: updatedMatch.rawTotals,
        teams: updatedMatch.game.map((team) => ({
          id: teamKey(team),
          name: team.name
        }))
      }
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "VOTE_FAILED",
      message: error.message || "Gagal menyimpan vote."
    });
  }
}
