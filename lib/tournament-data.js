import { generateTournamentWithByes } from "./bracket.js";

export const FREE_VOTES_PER_MATCH = 1;
export const DEFAULT_PRICE_PER_CREDIT_IDR = 2000;
export const ROUND_LABELS = ["Round 1", "Semifinal", "Final", "Champion"];

export const CATEGORY_DEFS = [
  {
    id: "one-piece",
    label: "Anime One Piece",
    subtitle: "Who wins the battle?",
    teams: [
      { name: "Luffy", id: "luffy", seed: 1 },
      { name: "Zoro", id: "zoro", seed: 2 },
      { name: "Sanji", id: "sanji", seed: 3 },
      { name: "Law", id: "law", seed: 4 },
      { name: "Shanks", id: "shanks", seed: 5 },
      { name: "Ace", id: "ace", seed: 6 },
      { name: "Sabo", id: "sabo", seed: 7 },
      { name: "Mihawk", id: "mihawk", seed: 8 }
    ]
  },
  {
    id: "football",
    label: "Football Clash",
    subtitle: "Big clubs face off",
    teams: [
      { name: "Real Madrid", id: "real-madrid", seed: 1 },
      { name: "Barcelona", id: "barcelona", seed: 2 },
      { name: "Liverpool", id: "liverpool", seed: 3 },
      { name: "Arsenal", id: "arsenal", seed: 4 },
      { name: "Bayern", id: "bayern", seed: 5 },
      { name: "PSG", id: "psg", seed: 6 },
      { name: "Inter", id: "inter", seed: 7 },
      { name: "Milan", id: "milan", seed: 8 }
    ]
  },
  {
    id: "esports",
    label: "Esports Arena",
    subtitle: "Squad battle voting",
    teams: [
      { name: "RRQ", id: "rrq", seed: 1 },
      { name: "EVOS", id: "evos", seed: 2 },
      { name: "ONIC", id: "onic", seed: 3 },
      { name: "Geek Fam", id: "geek-fam", seed: 4 },
      { name: "Bigetron", id: "bigetron", seed: 5 },
      { name: "Alter Ego", id: "alter-ego", seed: 6 },
      { name: "Liquid ID", id: "liquid-id", seed: 7 },
      { name: "Aura", id: "aura", seed: 8 }
    ]
  }
];

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

export function getCategoryById(categoryId) {
  return CATEGORY_DEFS.find((category) => category.id === categoryId) || null;
}

export function getPublicCategories() {
  return CATEGORY_DEFS.map((category) => ({
    id: category.id,
    label: category.label,
    subtitle: category.subtitle,
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

export function buildRuntimeState(categoryId, totals = {}, now = new Date()) {
  const category = getCategoryById(categoryId);

  if (!category) {
    throw new Error(`Unknown category: ${categoryId}`);
  }

  const seededTeams = category.teams.map((team) => ({
    ...team,
    image: getAvatarUrl(team)
  }));
  const baseData = generateTournamentWithByes(seededTeams, "top-seeds");
  const scheduleMap = buildScheduleMap(baseData, now);
  const data = cloneData(baseData);
  const matches = [];

  for (let roundIndex = 0; roundIndex < data.length; roundIndex += 1) {
    const round = data[roundIndex] || [];

    for (let gameIndex = 0; gameIndex < round.length; gameIndex += 1) {
      const game = round[gameIndex];
      if (!hasResolvedTeams(category, game)) continue;

      const matchId = getMatchId(categoryId, roundIndex, gameIndex, game);
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
      ...category,
      teams: seededTeams
    },
    baseData,
    data,
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

export function validateMatchSelection(categoryId, totals, matchId, teamId, now = new Date()) {
  const runtime = buildRuntimeState(categoryId, totals, now);
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
