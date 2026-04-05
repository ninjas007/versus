import { generateTournamentWithByes } from "./bracket.js";

export const FREE_VOTES_PER_MATCH = 1;
export const DEFAULT_PRICE_PER_CREDIT_IDR = 2000;

const DEFAULT_ROUND_LABELS_BY_TOTAL_ROUNDS = {
  2: ["Final", "Champion"],
  3: ["Semifinal", "Final", "Champion"],
  4: ["Quarterfinal", "Semifinal", "Final", "Champion"],
  5: ["Round of 16", "Quarterfinal", "Semifinal", "Final", "Champion"],
  6: ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final", "Champion"],
  7: [
    "Round of 64",
    "Round of 32",
    "Round of 16",
    "Quarterfinal",
    "Semifinal",
    "Final",
    "Champion"
  ]
};

export function cloneData(data) {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function teamKey(team) {
  return String(team?.id || team?.name || "").trim().toLowerCase();
}

export function getAvatarUrl(team) {
  if (!team) return "";
  if (team.image) return team.image;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(team.name || "Team")}&background=0F1726&color=E8EDF7&bold=true`;
}

function normalizeTeam(team, index) {
  const fallbackId = `team-${index + 1}`;
  const id = String(team?.id || fallbackId).trim().toLowerCase();
  const name = String(team?.name || fallbackId).trim();
  const seed = Number(team?.seed || index + 1);

  return {
    id,
    name,
    seed: Number.isFinite(seed) ? seed : index + 1,
    image: team?.image || ""
  };
}

function normalizeRoundLabelList(labels) {
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => String(label || "").trim())
    .filter(Boolean);
}

function normalizeRoundLabelPresets(presets) {
  if (!presets || typeof presets !== "object" || Array.isArray(presets)) {
    return {};
  }

  return Object.entries(presets).reduce((acc, [key, value]) => {
    const normalized = normalizeRoundLabelList(value);
    if (normalized.length) {
      acc[String(key).trim()] = normalized;
    }
    return acc;
  }, {});
}

function buildGenericRoundLabels(totalRounds) {
  if (totalRounds <= 1) {
    return ["Champion"];
  }

  const labels = [];
  for (let index = 0; index < totalRounds - 1; index += 1) {
    labels.push(`Round ${index + 1}`);
  }
  labels.push("Champion");
  return labels;
}

function fitRoundLabels(labels, totalRounds) {
  const normalized = normalizeRoundLabelList(labels);

  if (!normalized.length) {
    return buildGenericRoundLabels(totalRounds);
  }

  if (normalized.length === totalRounds) {
    return normalized;
  }

  if (normalized.length > totalRounds) {
    return normalized.slice(normalized.length - totalRounds);
  }

  const fallback = buildGenericRoundLabels(totalRounds);
  const missing = totalRounds - normalized.length;
  return fallback.slice(0, missing).concat(normalized);
}

export function resolveRoundLabels(category, totalRounds) {
  const participantCountKey = String(category?.teams?.length || "");
  const explicitLabels = normalizeRoundLabelList(category?.roundLabels);
  const presetKey = String(category?.roundLabelPreset || "").trim();
  const customPresets = normalizeRoundLabelPresets(category?.roundLabelPresets);

  const selectedLabels =
    explicitLabels.length > 0
      ? explicitLabels
      : presetKey && customPresets[presetKey]
        ? customPresets[presetKey]
        : customPresets[participantCountKey] ||
          DEFAULT_ROUND_LABELS_BY_TOTAL_ROUNDS[totalRounds] ||
          buildGenericRoundLabels(totalRounds);

  return fitRoundLabels(selectedLabels, totalRounds);
}

export function normalizeCategory(category, index = 0, globalRoundLabelPresets = {}) {
  const teams = Array.isArray(category?.teams) ? category.teams : [];
  const mergedRoundLabelPresets = {
    ...normalizeRoundLabelPresets(globalRoundLabelPresets),
    ...normalizeRoundLabelPresets(category?.roundLabelPresets)
  };

  return {
    id: String(category?.id || `category-${index + 1}`).trim().toLowerCase(),
    label: String(category?.label || category?.name || `Tournament ${index + 1}`).trim(),
    subtitle: String(category?.subtitle || "Who wins the battle?").trim(),
    roundLabels: normalizeRoundLabelList(category?.roundLabels),
    roundLabelPreset: String(category?.roundLabelPreset || "").trim(),
    roundLabelPresets: mergedRoundLabelPresets,
    teams: teams
      .map((team, teamIndex) => normalizeTeam(team, teamIndex))
      .sort((a, b) => a.seed - b.seed)
  };
}

export function normalizeCategories(source) {
  const globalRoundLabelPresets = normalizeRoundLabelPresets(
    source?.roundLabelPresets || source?.round_labels || {}
  );
  const categories = Array.isArray(source)
    ? source
    : Array.isArray(source?.categories)
      ? source.categories
      : Array.isArray(source?.tournaments)
        ? source.tournaments
        : [];

  return categories.map((category, index) =>
    normalizeCategory(category, index, globalRoundLabelPresets)
  );
}

export function getCategoryById(categoryDefs, categoryId) {
  return (categoryDefs || []).find((category) => category.id === categoryId) || null;
}

export function getPublicCategories(categoryDefs) {
  return (categoryDefs || []).map((category) => ({
    id: category.id,
    label: category.label,
    subtitle: category.subtitle,
    roundLabels: resolveRoundLabels(
      category,
      generateTournamentWithByes(
        category.teams.map((team) => ({ ...team, image: getAvatarUrl(team) })),
        "top-seeds"
      ).length
    ),
    teams: category.teams.map((team) => ({ ...team, image: getAvatarUrl(team) }))
  }));
}

export function isKnownTeam(category, team) {
  const id = teamKey(team);
  return category.teams.some((item) => teamKey(item) === id);
}

export function hasResolvedTeams(category, game) {
  return Boolean(
    game &&
      game.length === 2 &&
      isKnownTeam(category, game[0]) &&
      isKnownTeam(category, game[1])
  );
}

export function buildScheduleMap(baseData, now = new Date()) {
  const baseStart = addMinutes(now, -45);
  const roundGap = 80;
  const matchGap = 28;
  const duration = 25;
  const scheduleMap = {};
  let liveAssigned = false;

  baseData.forEach((round, roundIndex) => {
    (round || []).forEach((game, gameIndex) => {
      if (!game || game.length !== 2) return;

      let start = addMinutes(
        baseStart,
        roundIndex * roundGap + gameIndex * matchGap
      );

      if (!liveAssigned && roundIndex === 0 && gameIndex === 1) {
        start = addMinutes(now, -8);
        liveAssigned = true;
      }

      const end = addMinutes(start, duration);
      scheduleMap[`${roundIndex}:${gameIndex}`] = { start, end };
    });
  });

  return scheduleMap;
}

export function getMatchStatus(scheduleMap, roundIndex, gameIndex, now = Date.now()) {
  const schedule = scheduleMap?.[`${roundIndex}:${gameIndex}`];

  if (!schedule) {
    return {
      key: "upcoming",
      label: "Menunggu",
      canVote: false
    };
  }

  const currentTime = typeof now === "number" ? now : now.getTime();
  const startMs = schedule.start.getTime();
  const endMs = schedule.end.getTime();

  if (currentTime < startMs) {
    return {
      key: "upcoming",
      label: "Akan Datang",
      canVote: true
    };
  }

  if (currentTime >= startMs && currentTime < endMs) {
    return {
      key: "live",
      label: "Sedang Berlangsung",
      canVote: true
    };
  }

  return {
    key: "closed",
    label: "Selesai",
    canVote: false
  };
}

export function getMatchId(categoryId, roundIndex, gameIndex, game) {
  const aKey = teamKey(game?.[0]);
  const bKey = teamKey(game?.[1]);
  return `${categoryId}:${roundIndex}:${gameIndex}:${aKey}|${bKey}`;
}

export function buildAdvancedTeam(team) {
  return {
    id: team.id,
    name: team.name,
    seed: team.seed,
    image: team.image
  };
}

export function getRawTotal(totals, matchId, teamId) {
  const value = totals?.[matchId]?.[teamId];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function getWinnerFromScore(game) {
  if (!game || game.length !== 2) return null;

  const aScore = Number(game[0]?.score);
  const bScore = Number(game[1]?.score);

  if (!Number.isFinite(aScore) || !Number.isFinite(bScore)) return null;

  if (aScore === bScore) {
    return Number(game?.[0]?.seed || 99) <= Number(game?.[1]?.seed || 99)
      ? game[0]
      : game[1];
  }

  return aScore > bScore ? game[0] : game[1];
}

export function getDisplayScores(game, aVotes, bVotes, statusKey) {
  if (statusKey !== "closed") {
    return [aVotes, bVotes];
  }

  if (aVotes === bVotes) {
    const higherSeedIndex =
      Number(game?.[0]?.seed || 99) <= Number(game?.[1]?.seed || 99) ? 0 : 1;

    return higherSeedIndex === 0 ? [aVotes + 1, bVotes] : [aVotes, bVotes + 1];
  }

  return [aVotes, bVotes];
}

export function applyWinnerToNextRound(data, roundIndex, gameIndex, winner) {
  if (!winner || !data?.[roundIndex + 1]) return false;

  const nextRound = data[roundIndex + 1];
  const nextGameIndex = Math.floor(gameIndex / 2);
  const nextTeamIndex = gameIndex % 2;
  const nextGame = nextRound[nextGameIndex];

  if (!nextGame || nextGame.length === 0) return false;

  if (nextGame.length === 1) {
    const current = nextGame[0];
    if (current?.id === "champion" || current?.name === "Champion") {
      nextGame[0] = buildAdvancedTeam(winner);
      return true;
    }
    return false;
  }

  const currentTeam = nextGame[nextTeamIndex];
  if (currentTeam?.id === winner.id && currentTeam?.name === winner.name) {
    return false;
  }

  nextGame[nextTeamIndex] = buildAdvancedTeam(winner);
  return true;
}

export function buildRuntimeState(category, totals = {}, now = new Date()) {
  if (!category) {
    throw new Error("Category is required");
  }

  const normalizedCategory = normalizeCategory(category);
  const seededTeams = normalizedCategory.teams.map((team) => ({
    ...team,
    image: getAvatarUrl(team)
  }));
  const baseData = generateTournamentWithByes(seededTeams, "top-seeds");
  const roundLabels = resolveRoundLabels(normalizedCategory, baseData.length);
  const scheduleMap = buildScheduleMap(baseData, now);
  const data = cloneData(baseData);
  const matches = [];

  for (let roundIndex = 0; roundIndex < data.length; roundIndex += 1) {
    const round = data[roundIndex] || [];

    for (let gameIndex = 0; gameIndex < round.length; gameIndex += 1) {
      const game = round[gameIndex];
      if (!hasResolvedTeams(normalizedCategory, game)) continue;

      const matchId = getMatchId(normalizedCategory.id, roundIndex, gameIndex, game);
      const teamAKey = teamKey(game[0]);
      const teamBKey = teamKey(game[1]);
      const status = getMatchStatus(scheduleMap, roundIndex, gameIndex, now);
      const rawA = getRawTotal(totals, matchId, teamAKey);
      const rawB = getRawTotal(totals, matchId, teamBKey);
      const [displayA, displayB] = getDisplayScores(game, rawA, rawB, status.key);

      if (displayA > 0 || displayB > 0) {
        game[0].score = displayA;
        game[1].score = displayB;
      }

      if (status.key === "closed") {
        const winner = getWinnerFromScore(game);
        if (winner) {
          applyWinnerToNextRound(data, roundIndex, gameIndex, winner);
        }
      }

      matches.push({
        matchId,
        roundIndex,
        gameIndex,
        game,
        status,
        schedule: scheduleMap[`${roundIndex}:${gameIndex}`] || null,
        rawTotals: {
          [teamAKey]: rawA,
          [teamBKey]: rawB
        }
      });
    }
  }

  return {
    category: {
      ...normalizedCategory,
      teams: seededTeams
    },
    baseData,
    data,
    roundLabels,
    scheduleMap,
    matches
  };
}

export function buildTotalsMap(rows) {
  return (rows || []).reduce((acc, row) => {
    const matchId = row.match_id;
    const teamId = row.team_id;
    const totalVotes = Number(row.total_votes || 0);

    acc[matchId] = acc[matchId] || {};
    acc[matchId][teamId] = totalVotes;
    return acc;
  }, {});
}

export function buildUsageMap(rows) {
  return (rows || []).reduce((acc, row) => {
    acc[row.match_id] = {
      freeVotesUsed: Number(row.free_votes_used || 0),
      freeVotesRemaining: Math.max(
        0,
        FREE_VOTES_PER_MATCH - Number(row.free_votes_used || 0)
      )
    };
    return acc;
  }, {});
}

export function validateMatchSelection(category, totals, matchId, teamId, now = new Date()) {
  const runtime = buildRuntimeState(category, totals, now);
  const match = runtime.matches.find((item) => item.matchId === matchId) || null;

  if (!match) {
    return {
      ok: false,
      code: "MATCH_NOT_FOUND",
      message: "Match tidak ditemukan atau belum punya dua tim pasti."
    };
  }

  const hasTeam = match.game.some((team) => teamKey(team) === teamId);
  if (!hasTeam) {
    return {
      ok: false,
      code: "TEAM_NOT_IN_MATCH",
      message: "Tim yang dipilih tidak ada di match ini."
    };
  }

  if (!match.status.canVote) {
    return {
      ok: false,
      code: "MATCH_CLOSED",
      message: "Voting untuk match ini sudah ditutup."
    };
  }

  return {
    ok: true,
    runtime,
    match
  };
}
