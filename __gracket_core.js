var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const isByeGame = (game) => {
  return game.length === 1;
};
const getMatchWinner = (game) => {
  if (isByeGame(game)) {
    return game[0];
  }
  if (game.length !== 2) {
    return null;
  }
  const [team1, team2] = game;
  if (team1.score === void 0 || team2.score === void 0) {
    return null;
  }
  if (team1.score > team2.score) {
    return team1;
  } else if (team2.score > team1.score) {
    return team2;
  }
  return null;
};
const isRoundComplete = (round) => {
  if (!round || round.length === 0) {
    return false;
  }
  return round.every((game) => getMatchWinner(game) !== null);
};
const applyTieBreaker = (team1, team2, strategy, tieBreakerFn) => {
  switch (strategy) {
    case "higher-seed":
      if (team1.seed === team2.seed) return team1;
      return team1.seed < team2.seed ? team1 : team2;
    case "lower-seed":
      if (team1.seed === team2.seed) return team1;
      return team1.seed > team2.seed ? team1 : team2;
    case "callback":
      if (!tieBreakerFn) {
        throw new Error('Tie-breaker callback function is required when strategy is "callback"');
      }
      return tieBreakerFn(team1, team2);
    default:
      throw new Error(`Unknown tie-breaker strategy: ${strategy}`);
  }
};
const validateRoundComplete = (round, roundIndex) => {
  round.forEach((game, gameIndex) => {
    const winner = getMatchWinner(game);
    if (!winner) {
      if (isByeGame(game)) {
        throw new Error(`Round ${roundIndex + 1}, Game ${gameIndex + 1}: Bye game has no team`);
      }
      if (game.length !== 2) {
        throw new Error(`Round ${roundIndex + 1}, Game ${gameIndex + 1}: Invalid game structure (${game.length} teams)`);
      }
      const [team1, team2] = game;
      if (team1.score === void 0 || team2.score === void 0) {
        throw new Error(`Round ${roundIndex + 1}, Game ${gameIndex + 1}: Missing scores (${team1.name} vs ${team2.name})`);
      }
      if (team1.score === team2.score) {
        throw new Error(`Round ${roundIndex + 1}, Game ${gameIndex + 1}: Tied score (${team1.name} ${team1.score} - ${team2.name} ${team2.score}). Use tie-breaker option.`);
      }
    }
  });
};
const collectWinners = (round, tieBreaker = "error", tieBreakerFn) => {
  return round.map((game) => {
    const winner = getMatchWinner(game);
    if (winner) {
      return winner;
    }
    if (game.length === 2) {
      const [team1, team2] = game;
      if (team1.score !== void 0 && team2.score !== void 0 && team1.score === team2.score) {
        if (tieBreaker === "error") {
          throw new Error(`Tied score between ${team1.name} and ${team2.name}. Specify tie-breaker option.`);
        }
        return applyTieBreaker(team1, team2, tieBreaker, tieBreakerFn);
      }
    }
    throw new Error("Unable to determine winner for game");
  });
};
const generateNextRound = (winners, preserveScores = false) => {
  if (winners.length === 0) {
    return [];
  }
  if (winners.length === 1) {
    return [[{ ...winners[0], score: preserveScores ? winners[0].score : void 0 }]];
  }
  const nextRound = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      nextRound.push([
        { ...winners[i], score: preserveScores ? winners[i].score : void 0 },
        { ...winners[i + 1], score: preserveScores ? winners[i + 1].score : void 0 }
      ]);
    } else {
      nextRound.push([
        { ...winners[i], score: preserveScores ? winners[i].score : void 0 }
      ]);
    }
  }
  return nextRound;
};
const countTotalMatches = (rounds) => {
  let total = 0;
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    const isLastRound = r === rounds.length - 1;
    const isMultiRound = rounds.length > 1;
    const isChampionDisplay = isLastRound && isMultiRound && round.length === 1 && round[0].length === 1;
    if (isChampionDisplay) {
      continue;
    }
    total += round.length;
  }
  return total;
};
const countCompletedMatches = (rounds) => {
  let count = 0;
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    const isLastRound = r === rounds.length - 1;
    const isMultiRound = rounds.length > 1;
    for (const game of round) {
      const isChampionDisplay = isLastRound && isMultiRound && round.length === 1 && game.length === 1;
      if (isChampionDisplay) {
        continue;
      }
      if (getMatchWinner(game) !== null) {
        count++;
      }
    }
  }
  return count;
};
const countByes = (rounds) => {
  let count = 0;
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    const isLastRound = r === rounds.length - 1;
    const isMultiRound = rounds.length > 1;
    for (const game of round) {
      const isChampion = isLastRound && isMultiRound && round.length === 1 && game.length === 1;
      if (isByeGame(game) && !isChampion) {
        count++;
      }
    }
  }
  return count;
};
const getAdvancingTeams = (round) => {
  const winners = [];
  for (const game of round) {
    const winner = getMatchWinner(game);
    if (winner) {
      winners.push(winner);
    }
  }
  return winners;
};
const getGameResult = (game) => {
  if (isByeGame(game)) {
    return {
      winner: game[0],
      loser: null,
      winnerScore: game[0].score,
      loserScore: void 0,
      isBye: true
    };
  }
  if (game.length !== 2) {
    return null;
  }
  const [team1, team2] = game;
  const winner = getMatchWinner(game);
  if (!winner) {
    return null;
  }
  const loser = winner === team1 ? team2 : team1;
  return {
    winner,
    loser,
    winnerScore: winner.score,
    loserScore: loser.score,
    isBye: false
  };
};
const getRoundResults = (round) => {
  const results = [];
  for (const game of round) {
    const result = getGameResult(game);
    if (result) {
      results.push(result);
    }
  }
  return results;
};
const buildTeamHistory = (teamId, tournamentData, roundLabels = []) => {
  let team = null;
  const matches = [];
  let wins = 0;
  let losses = 0;
  for (let roundIndex = 0; roundIndex < tournamentData.length; roundIndex++) {
    const round = tournamentData[roundIndex];
    const roundLabel = roundLabels[roundIndex] || `Round ${roundIndex + 1}`;
    const isLastRound = roundIndex === tournamentData.length - 1;
    for (const game of round) {
      const teamInGame = game.find((t) => t.id === teamId);
      if (teamInGame) {
        team = teamInGame;
        if (isLastRound && round.length === 1 && game.length === 1) {
          break;
        }
        if (isByeGame(game)) {
          matches.push({
            roundIndex,
            roundLabel,
            opponent: null,
            won: true,
            score: teamInGame.score,
            opponentScore: void 0,
            isBye: true
          });
          wins++;
        } else if (game.length === 2) {
          const opponent = game.find((t) => t.id !== teamId);
          const winner = getMatchWinner(game);
          if (winner) {
            const won = winner.id === teamId;
            matches.push({
              roundIndex,
              roundLabel,
              opponent: opponent || null,
              won,
              score: teamInGame.score,
              opponentScore: opponent == null ? void 0 : opponent.score,
              isBye: false
            });
            if (won) {
              wins++;
            } else {
              losses++;
            }
          }
        }
        break;
      }
    }
  }
  if (!team) {
    return null;
  }
  let finalPlacement;
  const lastRound = tournamentData[tournamentData.length - 1];
  if (lastRound && lastRound.length === 1 && lastRound[0].length === 1) {
    if (lastRound[0][0].id === teamId) {
      finalPlacement = 1;
    }
  }
  if (!finalPlacement && tournamentData.length >= 2) {
    const finalsRound = tournamentData[tournamentData.length - 2];
    if (finalsRound && finalsRound.length === 1 && finalsRound[0].length === 2) {
      const inFinals = finalsRound[0].some((t) => t.id === teamId);
      const finalsWinner = getMatchWinner(finalsRound[0]);
      if (inFinals && finalsWinner && finalsWinner.id !== teamId) {
        finalPlacement = 2;
      }
    }
  }
  return {
    team,
    matches,
    finalPlacement,
    wins,
    losses
  };
};
const generateRoundReport = (round, roundIndex, roundLabel) => {
  const matches = getRoundResults(round);
  const advancingTeams = getAdvancingTeams(round);
  const isComplete = matches.length === round.length;
  return {
    roundIndex,
    roundLabel,
    isComplete,
    matches,
    advancingTeams
  };
};
const calculateStatistics = (tournamentData) => {
  const totalMatches = countTotalMatches(tournamentData);
  const completedMatches = countCompletedMatches(tournamentData);
  const byeCount = countByes(tournamentData);
  const uniqueTeams = /* @__PURE__ */ new Set();
  if (tournamentData.length > 0) {
    const firstRound = tournamentData[0];
    for (const game of firstRound) {
      for (const team of game) {
        if (team.id && team.name && !team.name.includes("TBD")) {
          uniqueTeams.add(team.id);
        }
      }
    }
  }
  let totalScore = 0;
  let scoreCount = 0;
  let highestScore;
  for (let roundIndex = 0; roundIndex < tournamentData.length; roundIndex++) {
    const round = tournamentData[roundIndex];
    for (const game of round) {
      for (const team of game) {
        if (team.score !== void 0) {
          totalScore += team.score;
          scoreCount++;
          if (!highestScore || team.score > highestScore.score) {
            highestScore = {
              team,
              score: team.score,
              round: roundIndex
            };
          }
        }
      }
    }
  }
  const averageScore = scoreCount > 0 ? totalScore / scoreCount : void 0;
  const completionPercentage = totalMatches > 0 ? Math.round(completedMatches / totalMatches * 100) : 0;
  return {
    participantCount: uniqueTeams.size,
    totalRounds: tournamentData.length,
    byeCount,
    averageScore,
    highestScore,
    completionPercentage
  };
};
const generateTournamentReport = (tournamentData, roundLabels = [], includeStatistics = false) => {
  const totalMatches = countTotalMatches(tournamentData);
  const completedMatches = countCompletedMatches(tournamentData);
  const remainingMatches = totalMatches - completedMatches;
  const allResults = [];
  let currentRound = 0;
  for (let i = 0; i < tournamentData.length; i++) {
    const round = tournamentData[i];
    const roundLabel = roundLabels[i] || `Round ${i + 1}`;
    const roundReport = generateRoundReport(round, i, roundLabel);
    allResults.push(roundReport);
    if (!roundReport.isComplete && i < currentRound) {
      currentRound = i;
    } else if (roundReport.isComplete) {
      currentRound = i + 1;
    }
  }
  let champion;
  let finalists;
  if (tournamentData.length > 0) {
    const lastRound = tournamentData[tournamentData.length - 1];
    if (lastRound.length === 1 && lastRound[0].length === 1) {
      champion = lastRound[0][0];
    }
    if (tournamentData.length >= 2) {
      const finalsRound = tournamentData[tournamentData.length - 2];
      if (finalsRound.length === 1 && finalsRound[0].length === 2) {
        finalists = [...finalsRound[0]];
      }
    }
  }
  const report = {
    totalRounds: tournamentData.length,
    totalMatches,
    completedMatches,
    remainingMatches,
    currentRound,
    champion,
    finalists,
    allResults
  };
  if (includeStatistics) {
    report.statistics = calculateStatistics(tournamentData);
  }
  return report;
};
const formatReportAsText = (report, includeScores = true) => {
  const lines = [];
  lines.push("=".repeat(50));
  lines.push("TOURNAMENT REPORT");
  lines.push("=".repeat(50));
  lines.push("");
  if (report.statistics) {
    lines.push("Tournament Statistics:");
    lines.push(`- Total Participants: ${report.statistics.participantCount}`);
    lines.push(`- Total Rounds: ${report.statistics.totalRounds}`);
    lines.push(`- Total Matches: ${report.totalMatches}`);
    lines.push(`- Completed: ${report.completedMatches}/${report.totalMatches} (${report.statistics.completionPercentage}%)`);
    if (report.statistics.byeCount > 0) {
      lines.push(`- Byes: ${report.statistics.byeCount}`);
    }
    if (report.statistics.averageScore !== void 0) {
      lines.push(`- Average Score: ${report.statistics.averageScore.toFixed(1)}`);
    }
    lines.push("");
  }
  for (const roundReport of report.allResults) {
    lines.push(`${roundReport.roundLabel.toUpperCase()}`);
    if (roundReport.matches.length === 0) {
      lines.push("  (No completed matches)");
    } else {
      roundReport.matches.forEach((match, idx) => {
        var _a;
        if (match.isBye) {
          lines.push(`  ? Match ${idx + 1}: ${match.winner.name} (BYE)`);
        } else {
          const winnerScore = includeScores && match.winnerScore !== void 0 ? ` (${match.winnerScore})` : "";
          const loserScore = includeScores && match.loserScore !== void 0 ? ` (${match.loserScore})` : "";
          lines.push(`  ? Match ${idx + 1}: ${match.winner.name}${winnerScore} defeated ${(_a = match.loser) == null ? void 0 : _a.name}${loserScore}`);
        }
      });
    }
    if (roundReport.advancingTeams.length > 0 && roundReport.roundIndex < report.totalRounds - 1) {
      lines.push("");
      lines.push(`  Advancing: ${roundReport.advancingTeams.map((t) => t.name).join(", ")}`);
    }
    lines.push("");
  }
  if (report.champion) {
    lines.push(`CHAMPION: ${report.champion.name} (Seed ${report.champion.seed})`);
    lines.push("=".repeat(50));
  }
  return lines.join("\n");
};
const formatReportAsMarkdown = (report, includeScores = true) => {
  const lines = [];
  lines.push("# Tournament Report");
  lines.push("");
  if (report.statistics) {
    lines.push("## Statistics");
    lines.push("");
    lines.push(`- **Participants**: ${report.statistics.participantCount}`);
    lines.push(`- **Total Rounds**: ${report.statistics.totalRounds}`);
    lines.push(`- **Completion**: ${report.completedMatches}/${report.totalMatches} (${report.statistics.completionPercentage}%)`);
    if (report.statistics.byeCount > 0) {
      lines.push(`- **Byes**: ${report.statistics.byeCount}`);
    }
    if (report.statistics.averageScore !== void 0) {
      lines.push(`- **Average Score**: ${report.statistics.averageScore.toFixed(1)}`);
    }
    lines.push("");
  }
  for (const roundReport of report.allResults) {
    lines.push(`## ${roundReport.roundLabel}`);
    lines.push("");
    if (roundReport.matches.length === 0) {
      lines.push("_(No completed matches)_");
      lines.push("");
    } else {
      if (includeScores) {
        lines.push("| Match | Winner | Score | Loser | Score |");
        lines.push("|-------|--------|-------|-------|-------|");
        roundReport.matches.forEach((match, idx) => {
          var _a;
          if (match.isBye) {
            lines.push(`| ${idx + 1} | ${match.winner.name} | - | BYE | - |`);
          } else {
            const winnerScore = match.winnerScore !== void 0 ? match.winnerScore : "-";
            const loserScore = match.loserScore !== void 0 ? match.loserScore : "-";
            lines.push(`| ${idx + 1} | ${match.winner.name} | ${winnerScore} | ${((_a = match.loser) == null ? void 0 : _a.name) || "-"} | ${loserScore} |`);
          }
        });
      } else {
        roundReport.matches.forEach((match, idx) => {
          var _a;
          if (match.isBye) {
            lines.push(`- **Match ${idx + 1}**: ${match.winner.name} (BYE)`);
          } else {
            lines.push(`- **Match ${idx + 1}**: ${match.winner.name} defeated ${(_a = match.loser) == null ? void 0 : _a.name}`);
          }
        });
      }
      lines.push("");
      if (roundReport.advancingTeams.length > 0 && roundReport.roundIndex < report.totalRounds - 1) {
        lines.push(`**Advancing**: ${roundReport.advancingTeams.map((t) => t.name).join(", ")}`);
        lines.push("");
      }
    }
  }
  if (report.champion) {
    lines.push(`## ?? Champion: ${report.champion.name}`);
    lines.push("");
  }
  return lines.join("\n");
};
const formatReportAsHTML = (report, includeScores = true) => {
  const lines = [];
  lines.push('<div class="tournament-report">');
  lines.push("  <h2>Tournament Report</h2>");
  if (report.statistics) {
    lines.push('  <div class="statistics">');
    lines.push("    <h3>Statistics</h3>");
    lines.push("    <ul>");
    lines.push(`      <li>Participants: ${report.statistics.participantCount}</li>`);
    lines.push(`      <li>Total Rounds: ${report.statistics.totalRounds}</li>`);
    lines.push(`      <li>Completion: ${report.completedMatches}/${report.totalMatches} (${report.statistics.completionPercentage}%)</li>`);
    if (report.statistics.byeCount > 0) {
      lines.push(`      <li>Byes: ${report.statistics.byeCount}</li>`);
    }
    if (report.statistics.averageScore !== void 0) {
      lines.push(`      <li>Average Score: ${report.statistics.averageScore.toFixed(1)}</li>`);
    }
    lines.push("    </ul>");
    lines.push("  </div>");
  }
  for (const roundReport of report.allResults) {
    lines.push('  <div class="round-report">');
    lines.push(`    <h3>${roundReport.roundLabel}</h3>`);
    if (roundReport.matches.length === 0) {
      lines.push("    <p><em>No completed matches</em></p>");
    } else {
      lines.push("    <table>");
      lines.push("      <thead>");
      lines.push("        <tr>");
      lines.push("          <th>Match</th>");
      lines.push("          <th>Winner</th>");
      if (includeScores) {
        lines.push("          <th>Score</th>");
      }
      lines.push("          <th>Loser</th>");
      if (includeScores) {
        lines.push("          <th>Score</th>");
      }
      lines.push("        </tr>");
      lines.push("      </thead>");
      lines.push("      <tbody>");
      roundReport.matches.forEach((match, idx) => {
        var _a;
        lines.push("        <tr>");
        lines.push(`          <td>${idx + 1}</td>`);
        lines.push(`          <td>${match.winner.name}</td>`);
        if (includeScores) {
          lines.push(`          <td>${match.winnerScore !== void 0 ? match.winnerScore : "-"}</td>`);
        }
        lines.push(`          <td>${match.isBye ? "BYE" : ((_a = match.loser) == null ? void 0 : _a.name) || "-"}</td>`);
        if (includeScores) {
          lines.push(`          <td>${match.loserScore !== void 0 ? match.loserScore : "-"}</td>`);
        }
        lines.push("        </tr>");
      });
      lines.push("      </tbody>");
      lines.push("    </table>");
      if (roundReport.advancingTeams.length > 0 && roundReport.roundIndex < report.totalRounds - 1) {
        lines.push(`    <p><strong>Advancing:</strong> ${roundReport.advancingTeams.map((t) => t.name).join(", ")}</p>`);
      }
    }
    lines.push("  </div>");
  }
  if (report.champion) {
    lines.push('  <div class="champion">');
    lines.push(`    <h3>?? Champion: ${report.champion.name}</h3>`);
    lines.push("  </div>");
  }
  lines.push("</div>");
  return lines.join("\n");
};
const _Gracket = class _Gracket {
  constructor(container, options = {}) {
    __publicField(this, "container");
    __publicField(this, "data");
    __publicField(this, "settings");
    __publicField(this, "maxRoundWidth", []);
    __publicField(this, "canvas", null);
    this.container = typeof container === "string" ? document.querySelector(container) : container;
    if (!this.container) {
      throw new Error("Gracket: Container element not found");
    }
    this.settings = {
      ..._Gracket.defaults,
      ...options,
      canvasId: `${options.canvasId || _Gracket.defaults.canvasId}_${Date.now()}`
    };
    this.data = this.settings.src.length ? this.settings.src : this.parseDataAttribute();
    if (!this.data.length) {
      throw new Error("Gracket: No tournament data provided");
    }
    this.init();
  }
  /** Parse data from data attribute */
  parseDataAttribute() {
    const dataAttr = this.container.getAttribute("data-gracket");
    if (!dataAttr) return [];
    try {
      return JSON.parse(dataAttr);
    } catch (error) {
      console.error("Gracket: Failed to parse data attribute", error);
      return [];
    }
  }
  /** Initialize the bracket */
  init() {
    this.container.innerHTML = "";
    this.container.classList.add(this.settings.gracketClass);
    this.canvas = this.createCanvas();
    this.container.appendChild(this.canvas);
    this.buildBracket();
  }
  /** Create the canvas element */
  createCanvas() {
    const canvas = document.createElement("canvas");
    canvas.id = this.settings.canvasId;
    canvas.className = this.settings.canvasClass;
    Object.assign(canvas.style, {
      position: "absolute",
      left: "0",
      top: "0",
      right: "auto"
    });
    return canvas;
  }
  /** Build the bracket structure */
  buildBracket() {
    const roundCount = this.data.length;
    for (let r = 0; r < roundCount; r++) {
      const roundEl = this.createRound();
      this.container.appendChild(roundEl);
      const games = this.data[r];
      const gameCount = games.length;
      for (let g = 0; g < gameCount; g++) {
        const gameEl = this.createGame();
        const outerHeight = this.getGameOuterHeight();
        if (g % 1 === 0 && r !== 0) {
          const spacer = this.createSpacer(outerHeight, r, g === 0);
          roundEl.appendChild(spacer);
        }
        roundEl.appendChild(gameEl);
        const teams = games[g];
        const teamCount = teams.length;
        const isChampion = r === roundCount - 1 && // Last round
        roundCount > 1 && // Multi-round tournament
        games.length === 1 && // Only one game in round
        teamCount === 1;
        const isBye = isByeGame(teams) && !isChampion;
        if (isBye && teamCount === 1) {
          const teamEl = this.createTeam(teams[0]);
          gameEl.appendChild(teamEl);
          if (this.settings.showByeGames) {
            const byeEl = this.createByePlaceholder();
            gameEl.appendChild(byeEl);
          }
          const teamWidth = this.getOuterWidth(teamEl);
          if (!this.maxRoundWidth[r] || this.maxRoundWidth[r] < teamWidth) {
            this.maxRoundWidth[r] = teamWidth;
          }
        } else {
          for (let t = 0; t < teamCount; t++) {
            const teamEl = this.createTeam(teams[t]);
            gameEl.appendChild(teamEl);
            const teamWidth = this.getOuterWidth(teamEl);
            if (!this.maxRoundWidth[r] || this.maxRoundWidth[r] < teamWidth) {
              this.maxRoundWidth[r] = teamWidth;
            }
            if (teamCount === 1 && r === roundCount - 1) {
              const prevSpacer = gameEl.previousElementSibling;
              prevSpacer == null ? void 0 : prevSpacer.remove();
              const prevRound = roundEl.previousElementSibling;
              const firstGame = prevRound == null ? void 0 : prevRound.children[0];
              if (firstGame) {
                this.alignWinner(gameEl, firstGame.offsetHeight);
              }
            }
          }
        }
      }
    }
    this.setupInteractivity();
    if (this.data.length >= 1) {
      const firstRound = this.container.querySelectorAll(`.${this.settings.roundClass}`)[0];
      const firstGame = firstRound == null ? void 0 : firstRound.querySelector(`.${this.settings.gameClass}`);
      if (firstGame) {
        this.resizeCanvas();
        this.drawCanvas(firstGame);
      }
    }
  }
  /** Create a round element */
  createRound() {
    const div = document.createElement("div");
    div.className = this.settings.roundClass;
    return div;
  }
  /** Create a game element */
  createGame() {
    const div = document.createElement("div");
    div.className = this.settings.gameClass;
    return div;
  }
  /** Create a team element */
  createTeam(team) {
    const div = document.createElement("div");
    div.className = `${this.settings.teamClass} ${team.id || "id_null"}`;
    const scoreTitle = team.score !== void 0 ? ` title="Score: ${team.score}"` : "";
    const displaySeed = team.displaySeed ?? team.seed;
    const scoreDisplay = team.score !== void 0 ? `<small class="g_score">${team.score}</small>` : '<small class="g_score g_score-empty">—</small>';
    div.innerHTML = `
      <h3${scoreTitle}>
        <span class="${this.settings.seedClass}">${displaySeed}</span>
        <span class="g_team-name">${team.name}</span>
        ${scoreDisplay}
      </h3>
    `;
    return div;
  }
  /** Create a bye placeholder element (Issue #15) */
  createByePlaceholder() {
    const div = document.createElement("div");
    div.className = `${this.settings.teamClass} ${this.settings.byeClass}`;
    div.innerHTML = `
      <h3>
        <span class="g_team-name">${this.settings.byeLabel}</span>
      </h3>
    `;
    return div;
  }
  /** Create a spacer element */
  createSpacer(yOffset, round, isFirst) {
    const div = document.createElement("div");
    div.className = this.settings.spacerClass;
    const height = isFirst ? (Math.pow(2, round) - 1) * (yOffset / 2) : (Math.pow(2, round) - 1) * yOffset;
    div.style.height = `${height}px`;
    return div;
  }
  /** Align winner position */
  alignWinner(gameEl, yOffset) {
    var _a;
    const parent = gameEl.parentElement;
    const isOneGame = ((_a = parent == null ? void 0 : parent.parentElement) == null ? void 0 : _a.querySelectorAll(":scope > div:not(canvas)").length) === 1;
    const winnerPadding = 40;
    const offset = isOneGame ? yOffset - (gameEl.offsetHeight + gameEl.offsetHeight / 2) - winnerPadding / 2 : yOffset + gameEl.offsetHeight / 2 - winnerPadding / 2;
    gameEl.classList.add(this.settings.winnerClass);
    gameEl.style.marginTop = `${offset}px`;
  }
  /** Setup hover listeners and interactivity */
  setupInteractivity() {
    const teams = this.container.querySelectorAll(`.${this.settings.teamClass} > h3`);
    teams.forEach((teamH3) => {
      const teamDiv = teamH3.parentElement;
      const classes = teamDiv.className.split(" ");
      const idClass = classes[1];
      if (idClass && idClass !== "id_null") {
        const selector = `.${idClass}`;
        const matchingTeams = this.container.querySelectorAll(selector);
        matchingTeams.forEach((el) => {
          el.addEventListener("mouseenter", () => {
            matchingTeams.forEach((t) => t.classList.add(this.settings.currentClass));
          });
          el.addEventListener("mouseleave", () => {
            matchingTeams.forEach((t) => t.classList.remove(this.settings.currentClass));
          });
        });
      }
    });
  }
  /** Resize canvas to container size */
  resizeCanvas() {
    if (!this.canvas) return;
    const height = this.container.offsetHeight;
    const width = this.container.offsetWidth;
    this.canvas.height = height;
    this.canvas.width = width;
    Object.assign(this.canvas.style, {
      height: `${height}px`,
      width: `${width}px`,
      zIndex: "1",
      pointerEvents: "none"
    });
  }
  /** Draw bracket lines on canvas */
  drawCanvas(gameEl) {
    const itemWidth = this.maxRoundWidth[0] || 0;
    const paddingLeft = parseInt(getComputedStyle(this.container).paddingLeft) || 0;
    const paddingTop = parseInt(getComputedStyle(this.container).paddingTop) || 0;
    const marginRight = parseInt(getComputedStyle(gameEl.parentElement).marginRight) || 0;
    this.drawLabels({
      padding: paddingLeft,
      left: itemWidth + paddingLeft,
      right: marginRight,
      labels: this.settings.roundLabels,
      class: this.settings.roundLabelClass,
      width: itemWidth
    });
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    if (!gameEl.children[1]) return;
    const itemHeight = this.getGameOuterHeight();
    let cornerRadius = this.settings.cornerRadius;
    let lineGap = this.settings.canvasLineGap;
    cornerRadius = Math.max(1, Math.min(cornerRadius, itemHeight / 3, marginRight / 2 - 2));
    lineGap = Math.min(lineGap, marginRight / 3);
    const playerGap = gameEl.offsetHeight - 2 * gameEl.children[1].offsetHeight;
    const playerHt = gameEl.children[1].offsetHeight;
    ctx.strokeStyle = this.settings.canvasLineColor;
    ctx.lineCap = this.settings.canvasLineCap;
    ctx.lineWidth = this.settings.canvasLineWidth;
    ctx.beginPath();
    let p = Math.pow(2, this.data.length - 2);
    let i = 0;
    let totalItemWidth = 0;
    const startingLeftPos = itemWidth + paddingLeft;
    while (p >= 1) {
      for (let j = 0; j < p; j++) {
        const r = p === 1 ? 1 : 0.5;
        const xInit = startingLeftPos + totalItemWidth + i * marginRight;
        const xDisp = r * marginRight;
        const yInit = ((Math.pow(2, i - 1) - 0.5) * (i && 1) + j * Math.pow(2, i)) * itemHeight + paddingTop + playerHt + playerGap / 2;
        if (p > 1) {
          ctx.moveTo(xInit + lineGap, yInit);
          ctx.lineTo(xInit + xDisp - cornerRadius, yInit);
        } else {
          ctx.moveTo(xInit + lineGap, yInit);
          ctx.lineTo(xInit + 3 * lineGap, yInit);
        }
        if (p > 1 && j % 2 === 0) {
          const yTop = yInit + cornerRadius;
          const yBottom = yInit + Math.pow(2, i) * itemHeight - cornerRadius;
          ctx.moveTo(xInit + xDisp, yTop);
          ctx.lineTo(xInit + xDisp, yBottom);
          const cx = xInit + xDisp - cornerRadius;
          let cy = yInit + cornerRadius;
          ctx.moveTo(cx, cy - cornerRadius);
          ctx.arcTo(cx + cornerRadius, cy - cornerRadius, cx + cornerRadius, cy, cornerRadius);
          cy = yInit + Math.pow(2, i) * itemHeight - cornerRadius;
          ctx.moveTo(cx + cornerRadius, cy - cornerRadius);
          ctx.arcTo(cx + cornerRadius, cy + cornerRadius, cx, cy + cornerRadius, cornerRadius);
          const yMiddle = (yTop + yBottom) / 2;
          ctx.moveTo(xInit + xDisp, yMiddle);
          ctx.lineTo(xInit + xDisp + lineGap, yMiddle);
        }
      }
      i++;
      totalItemWidth += this.maxRoundWidth[i] || 0;
      p = p / 2;
    }
    ctx.stroke();
  }
  /** Draw round labels */
  drawLabels(offset) {
    let widthPadding = 0;
    for (let i = 0; i < this.data.length; i++) {
      const roundWidth = this.maxRoundWidth[i] || 0;
      const left = i === 0 ? offset.padding + widthPadding + roundWidth / 2 : offset.padding + widthPadding + offset.right * i + roundWidth / 2;
      const label = document.createElement("h5");
      label.innerHTML = offset.labels.length ? offset.labels[i] : `Round ${i + 1}`;
      label.className = offset.class;
      Object.assign(label.style, {
        position: "absolute",
        left: `${left}px`,
        transform: "translateX(-50%)",
        whiteSpace: "nowrap"
      });
      this.container.appendChild(label);
      widthPadding += roundWidth;
    }
  }
  /** Get outer height of game element including margins */
  getGameOuterHeight() {
    const games = this.container.querySelectorAll(`.${this.settings.gameClass}`);
    if (!games.length) return 0;
    const game = games[0];
    const style = getComputedStyle(game);
    const marginTop = parseInt(style.marginTop) || 0;
    const marginBottom = parseInt(style.marginBottom) || 0;
    return game.offsetHeight + marginTop + marginBottom;
  }
  /** Get outer width including margins */
  getOuterWidth(el) {
    const style = getComputedStyle(el);
    const marginLeft = parseInt(style.marginLeft) || 0;
    const marginRight = parseInt(style.marginRight) || 0;
    return el.offsetWidth + marginLeft + marginRight;
  }
  /** Update tournament data and re-render */
  update(data) {
    this.data = data;
    this.maxRoundWidth = [];
    this.init();
  }
  /** Destroy the bracket and clean up */
  destroy() {
    this.container.innerHTML = "";
    this.container.classList.remove(this.settings.gracketClass);
  }
  /** Get current settings */
  getSettings() {
    return { ...this.settings };
  }
  /** Get current tournament data */
  getData() {
    return [...this.data];
  }
  // ===================================================================
  // NEW METHODS FOR ISSUES #14 & #15
  // ===================================================================
  // -------------------------------------------------------------------
  // Score Management Methods (Issue #14a)
  // -------------------------------------------------------------------
  /**
   * Update a team's score in a specific match
   * @param roundIndex - Round index (0-based)
   * @param gameIndex - Game index within round (0-based)
   * @param teamIndex - Team index within game (0 or 1)
   * @param score - New score value
   */
  updateScore(roundIndex, gameIndex, teamIndex, score) {
    if (roundIndex < 0 || roundIndex >= this.data.length) {
      throw new Error(`Invalid round index: ${roundIndex}`);
    }
    const round = this.data[roundIndex];
    if (gameIndex < 0 || gameIndex >= round.length) {
      throw new Error(`Invalid game index: ${gameIndex} in round ${roundIndex}`);
    }
    const game = round[gameIndex];
    if (teamIndex < 0 || teamIndex >= game.length) {
      throw new Error(`Invalid team index: ${teamIndex} in round ${roundIndex}, game ${gameIndex}`);
    }
    game[teamIndex].score = score;
    if (this.settings.onScoreUpdate) {
      this.settings.onScoreUpdate(roundIndex, gameIndex, teamIndex, score);
    }
    if (this.settings.onRoundComplete && isRoundComplete(round)) {
      this.settings.onRoundComplete(roundIndex);
    }
    this.init();
  }
  /**
   * Get the winner of a specific match
   * @param roundIndex - Round index (0-based)
   * @param gameIndex - Game index within round (0-based)
   * @returns Winning team or null if match is not complete
   */
  getMatchWinner(roundIndex, gameIndex) {
    if (roundIndex < 0 || roundIndex >= this.data.length) {
      return null;
    }
    const round = this.data[roundIndex];
    if (gameIndex < 0 || gameIndex >= round.length) {
      return null;
    }
    return getMatchWinner(round[gameIndex]);
  }
  /**
   * Check if all matches in a round are complete
   * @param roundIndex - Round index (0-based)
   * @returns True if all matches have determined winners
   */
  isRoundComplete(roundIndex) {
    if (roundIndex < 0 || roundIndex >= this.data.length) {
      throw new Error(`Invalid round index: ${roundIndex}. Tournament has ${this.data.length} rounds.`);
    }
    return isRoundComplete(this.data[roundIndex]);
  }
  /**
   * Advance winners to the next round
   * @param fromRound - Round index to advance from (default: first incomplete round)
   * @param options - Configuration for advancement behavior
   * @returns Updated tournament data
   */
  advanceRound(fromRound, options = {}) {
    let roundIndex = fromRound;
    if (roundIndex === void 0) {
      roundIndex = this.data.findIndex((round2) => !isRoundComplete(round2));
      if (roundIndex === -1) {
        throw new Error("No incomplete rounds found");
      }
    }
    if (roundIndex < 0 || roundIndex >= this.data.length) {
      throw new Error(`Invalid round index: ${roundIndex}`);
    }
    const round = this.data[roundIndex];
    const {
      tieBreaker = "error",
      tieBreakerFn,
      preserveScores = false,
      createRounds = false
    } = options;
    if (tieBreaker === "error") {
      validateRoundComplete(round, roundIndex);
    }
    const winners = collectWinners(round, tieBreaker, tieBreakerFn);
    const nextRound = generateNextRound(winners, preserveScores);
    if (roundIndex + 1 < this.data.length) {
      this.data[roundIndex + 1] = nextRound;
    } else if (createRounds) {
      this.data.push(nextRound);
    } else {
      throw new Error(`Round ${roundIndex + 2} does not exist. Use createRounds: true to create it.`);
    }
    if (this.settings.onRoundComplete) {
      this.settings.onRoundComplete(roundIndex);
    }
    if (this.settings.onRoundGenerated) {
      this.settings.onRoundGenerated(roundIndex + 1, nextRound);
    }
    this.init();
    return this.data;
  }
  /**
   * Auto-generate entire tournament from results
   * Automatically advances through all completed rounds
   * @param options - Configuration options
   */
  autoGenerateTournament(options = {}) {
    const { stopAtRound, onRoundGenerated, ...advanceOptions } = options;
    let currentRound = 0;
    const maxIterations = 20;
    let iterations = 0;
    while (currentRound < this.data.length && iterations < maxIterations) {
      iterations++;
      if (!isRoundComplete(this.data[currentRound])) {
        break;
      }
      if (stopAtRound !== void 0 && currentRound >= stopAtRound) {
        break;
      }
      try {
        const initialLength = this.data.length;
        this.advanceRound(currentRound, {
          ...advanceOptions,
          createRounds: true
        });
        if (onRoundGenerated && this.data.length > initialLength) {
          onRoundGenerated(currentRound + 1, this.data[currentRound + 1]);
        }
      } catch (error) {
        console.error(`Failed to advance round ${currentRound}:`, error);
        break;
      }
      currentRound++;
    }
  }
  // -------------------------------------------------------------------
  // Reporting & Query Methods (Issue #14b)
  // -------------------------------------------------------------------
  /**
   * Get teams advancing from a specific round
   * @param roundIndex - Round index (default: latest round with results)
   * @returns Array of teams advancing to next round
   */
  getAdvancingTeams(roundIndex) {
    let idx = roundIndex;
    if (idx === void 0) {
      for (let i = this.data.length - 1; i >= 0; i--) {
        if (isRoundComplete(this.data[i])) {
          idx = i;
          break;
        }
      }
      if (idx === void 0) {
        return [];
      }
    }
    if (idx < 0 || idx >= this.data.length) {
      return [];
    }
    return getAdvancingTeams(this.data[idx]);
  }
  /**
   * Get detailed results for a round
   * @param roundIndex - Round index
   * @returns Array of match results with winners and losers
   */
  getRoundResults(roundIndex) {
    if (roundIndex < 0 || roundIndex >= this.data.length) {
      return [];
    }
    return getRoundResults(this.data[roundIndex]);
  }
  /**
   * Get a team's tournament history
   * @param teamId - Team identifier
   * @returns Complete history of team's matches
   */
  getTeamHistory(teamId) {
    return buildTeamHistory(teamId, this.data, this.settings.roundLabels);
  }
  /**
   * Get tournament statistics
   * @returns Various tournament statistics
   */
  getStatistics() {
    return calculateStatistics(this.data);
  }
  /**
   * Generate a tournament report
   * @param options - Reporting options
   * @returns Formatted tournament report
   */
  generateReport(options = {}) {
    const {
      format = "json",
      includeScores = true,
      includeStatistics = false
    } = options;
    const report = generateTournamentReport(
      this.data,
      this.settings.roundLabels,
      includeStatistics
    );
    switch (format) {
      case "json":
        return report;
      case "text":
        return formatReportAsText(report, includeScores);
      case "html":
        return formatReportAsHTML(report, includeScores);
      case "markdown":
        return formatReportAsMarkdown(report, includeScores);
      default:
        throw new Error(`Unknown report format: ${format}`);
    }
  }
};
/** Default configuration */
__publicField(_Gracket, "defaults", {
  gracketClass: "g_gracket",
  gameClass: "g_game",
  roundClass: "g_round",
  roundLabelClass: "g_round_label",
  teamClass: "g_team",
  winnerClass: "g_winner",
  spacerClass: "g_spacer",
  currentClass: "g_current",
  seedClass: "g_seed",
  cornerRadius: 15,
  canvasId: "g_canvas",
  canvasClass: "g_canvas",
  canvasLineColor: "#eee",
  canvasLineCap: "round",
  canvasLineWidth: 2,
  canvasLineGap: 15,
  roundLabels: [],
  src: [],
  // New defaults for Issues #14 & #15
  byeLabel: "BYE",
  byeClass: "g_bye",
  showByeGames: true
});
let Gracket = _Gracket;
export {
  Gracket as G
};
//# sourceMappingURL=Gracket-BZRBctjt.js.map

