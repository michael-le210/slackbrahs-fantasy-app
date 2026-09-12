export function createAppState() {
  return {
    leagues: [],
    selectedLeague: "",
    profile: null,
    signedIn: false,
    latestScoreboard: null,
    categoryStrengths: null,
    categoryStrengthsLeague: "",
    activeView: "comparison",
    showRanks: true,
    theme: "dark"
  };
}

export function filterRecentLeagues(leagues, seasonCount = 5) {
  const seasons = leagues
    .map((league) => Number(league.season))
    .filter((season) => Number.isFinite(season));
  if (!seasons.length) return leagues;

  const latestSeason = Math.max(...seasons);
  const earliestSeason = latestSeason - seasonCount + 1;
  return leagues.filter((league) => {
    const season = Number(league.season);
    return Number.isFinite(season) && season >= earliestSeason && season <= latestSeason;
  });
}
