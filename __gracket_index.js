import { G } from "./Gracket-BZRBctjt.js";
const nextPowerOf2 = (n) => {
  return Math.pow(2, Math.ceil(Math.log2(n)));
};
const calculateByesNeeded = (teamCount) => {
  if (teamCount < 2) {
    throw new Error("Tournament must have at least 2 teams");
  }
  const nextPower = nextPowerOf2(teamCount);
  return nextPower - teamCount;
};
const shuffleArray = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const generateTournamentWithByes = (teams, strategy = "top-seeds") => {
  if (teams.length < 2) {
    throw new Error("Tournament must have at least 2 teams");
  }
  const teamCount = teams.length;
  const byesNeeded = calculateByesNeeded(teamCount);
  if (byesNeeded === 0) {
    return generateRegularTournament(teams);
  }
  let byeTeams;
  let playingTeams;
  switch (strategy) {
    case "top-seeds": {
      const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed);
      byeTeams = sortedTeams.slice(0, byesNeeded);
      playingTeams = sortedTeams.slice(byesNeeded);
      break;
    }
    case "random": {
      const shuffled = shuffleArray(teams);
      byeTeams = shuffled.slice(0, byesNeeded);
      playingTeams = shuffled.slice(byesNeeded);
      break;
    }
    case "custom": {
      throw new Error("Custom bye strategy not implemented. Please manually create tournament structure with single-team games for byes.");
    }
    default:
      throw new Error(`Unknown bye seeding strategy: ${strategy}`);
  }
  const firstRound = [];
  for (let i = 0; i < playingTeams.length; i += 2) {
    if (i + 1 < playingTeams.length) {
      firstRound.push([playingTeams[i], playingTeams[i + 1]]);
    } else {
      firstRound.push([playingTeams[i]]);
    }
  }
  byeTeams.forEach((team) => {
    firstRound.push([team]);
  });
  const tournamentData = [firstRound];
  let currentWinners = firstRound.length;
  while (currentWinners > 1) {
    const nextRound = [];
    const gamesInRound = Math.floor(currentWinners / 2);
    for (let i = 0; i < gamesInRound; i++) {
      nextRound.push([
        { name: `Winner ${i * 2 + 1}`, seed: i * 2 + 1, id: `winner-r${tournamentData.length}-g${i * 2}` },
        { name: `Winner ${i * 2 + 2}`, seed: i * 2 + 2, id: `winner-r${tournamentData.length}-g${i * 2 + 1}` }
      ]);
    }
    if (currentWinners % 2 === 1) {
      nextRound.push([
        { name: `Winner ${currentWinners}`, seed: currentWinners, id: `winner-r${tournamentData.length}-g${currentWinners - 1}` }
      ]);
    }
    tournamentData.push(nextRound);
    currentWinners = nextRound.length;
  }
  if (currentWinners === 1) {
    tournamentData.push([[
      { name: "Champion", seed: 1, id: "champion" }
    ]]);
  }
  return tournamentData;
};
const generateRegularTournament = (teams) => {
  if ((teams.length & teams.length - 1) !== 0) {
    throw new Error("Team count must be a power of 2 for regular tournament");
  }
  const tournamentData = [];
  const firstRound = [];
  for (let i = 0; i < teams.length; i += 2) {
    firstRound.push([teams[i], teams[i + 1]]);
  }
  tournamentData.push(firstRound);
  let currentWinners = firstRound.length;
  while (currentWinners > 1) {
    const nextRound = [];
    const gamesInRound = Math.floor(currentWinners / 2);
    for (let i = 0; i < gamesInRound; i++) {
      nextRound.push([
        { name: `Winner ${i * 2 + 1}`, seed: i * 2 + 1, id: `winner-r${tournamentData.length}-g${i * 2}` },
        { name: `Winner ${i * 2 + 2}`, seed: i * 2 + 2, id: `winner-r${tournamentData.length}-g${i * 2 + 1}` }
      ]);
    }
    tournamentData.push(nextRound);
    currentWinners = nextRound.length;
  }
  tournamentData.push([[
    { name: "Champion", seed: 1, id: "champion" }
  ]]);
  return tournamentData;
};
export {
  G as Gracket,
  calculateByesNeeded,
  generateTournamentWithByes
};
//# sourceMappingURL=index.js.map

