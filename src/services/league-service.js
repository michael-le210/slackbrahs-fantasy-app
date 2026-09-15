import {
  extractGames,
  extractLeagues,
  extractScoreboard,
  extractStatCategories,
  extractUserTeams,
  buildCategoryStrengths,
  buildLeagueComparison,
  yahooApiPaths
} from "../models/yahoo-models.js";
import { mapWithConcurrency } from "../utils/async.js";

export class LeagueService {
  constructor(yahooApi, { cacheTtlMs = 5 * 60_000 } = {}) {
    this.yahooApi = yahooApi;
    this.cacheTtlMs = cacheTtlMs;
  }

  async listHistoricalH2h(session) {
    if (session.h2hLeagues && isFresh(session.h2hLeaguesFetchedAt, this.cacheTtlMs)) {
      return session.h2hLeagues;
    }

    const gamesData = await this.yahooApi.fetch(session, yahooApiPaths.userNbaGames, {
      timeoutMs: 8_000,
      retries: 1
    });
    const games = keepRecentSeasons(
      extractGames(gamesData)
        .filter((game) => !game.code || game.code === "nba")
        .sort((a, b) => (b.season || 0) - (a.season || 0))
    );

    const leagueGroups = await mapWithConcurrency(games, 4, async (game) => {
      try {
        const data = await this.yahooApi.fetch(session, yahooApiPaths.userLeaguesByGameKey(game.gameKey), {
          timeoutMs: 6_000,
          retries: 0
        });
        return extractLeagues(data).map((league) => ({ ...league, season: league.season || game.season }));
      } catch (error) {
        console.warn(`Unable to load Yahoo NBA leagues for game ${game.gameKey}: ${error.message}`);
        return [];
      }
    });

    session.h2hLeagues = leagueGroups
      .flat()
      .filter((league) => league.scoringType.toLowerCase().startsWith("head"))
      .sort((a, b) => (b.season || 0) - (a.season || 0));
    session.h2hLeaguesFetchedAt = Date.now();
    return session.h2hLeagues;
  }

  async getSignedInManager(session, leagues = session.h2hLeagues || []) {
    if (session.myTeamManager) return session.myTeamManager;
    const league = leagues[0];
    if (!league?.leagueKey) return "";

    try {
      const gameKey = league.leagueKey.split(".l.")[0];
      const userTeams = await this.getUserTeams(session, gameKey);
      const team = userTeams.find((item) => item.leagueKey === league.leagueKey) || userTeams.find((item) => item.manager);
      session.myTeamManager = team?.manager || "";
    } catch (error) {
      console.warn(`Unable to identify the signed-in Yahoo manager: ${error.message}`);
    }

    return session.myTeamManager || "";
  }

  async getWeek(session, leagueKey, week) {
    const gameKey = leagueKey.split(".l.")[0];
    const [data, statCategories, userTeams] = await Promise.all([
      this.yahooApi.fetch(session, yahooApiPaths.leagueScoreboard(leagueKey, week)),
      this.getStatCategories(session, leagueKey),
      this.getUserTeams(session, gameKey).catch((error) => {
        console.warn(`Unable to identify the signed-in Yahoo team for ${leagueKey}: ${error.message}`);
        return [];
      })
    ]);
    const scoreboard = extractScoreboard(data, statCategories);
    const userTeamKeys = userTeams
      .filter((team) => team.leagueKey === leagueKey)
      .map((team) => team.teamKey);

    return {
      ...scoreboard,
      comparison: buildLeagueComparison(scoreboard, statCategories, userTeamKeys)
    };
  }

  async getUserTeams(session, gameKey) {
    session.userTeams ||= new Map();
    if (session.userTeams.has(gameKey)) return session.userTeams.get(gameKey);

    const data = await this.yahooApi.fetch(session, yahooApiPaths.userTeamsByGameKey(gameKey), {
      timeoutMs: 8_000,
      retries: 1
    });
    const teams = extractUserTeams(data);
    session.userTeams.set(gameKey, teams);
    return teams;
  }

  async getCategoryStrengths(session, leagueKey) {
    session.categoryStrengths ||= new Map();
    const cached = session.categoryStrengths.get(leagueKey);
    if (cached && isFresh(cached.fetchedAt, this.cacheTtlMs)) return cached.data;

    session.categoryStrengthRequests ||= new Map();
    if (session.categoryStrengthRequests.has(leagueKey)) {
      return session.categoryStrengthRequests.get(leagueKey);
    }

    const request = this.loadCategoryStrengths(session, leagueKey);
    session.categoryStrengthRequests.set(leagueKey, request);
    try {
      const strengths = await request;
      session.categoryStrengths.set(leagueKey, { data: strengths, fetchedAt: Date.now() });
      return strengths;
    } finally {
      if (session.categoryStrengthRequests.get(leagueKey) === request) {
        session.categoryStrengthRequests.delete(leagueKey);
      }
    }
  }

  async loadCategoryStrengths(session, leagueKey) {
    const league = session.h2hLeagues?.find((item) => item.leagueKey === leagueKey);
    const startWeek = Math.max(1, league?.startWeek || 1);
    const seasonEndWeek = league?.endWeek || league?.currentWeek || 20;
    const lastWeek = league?.isFinished
      ? seasonEndWeek
      : Math.min(league?.currentWeek || seasonEndWeek, seasonEndWeek);
    const gameKey = leagueKey.split(".l.")[0];
    const [statCategories, userTeams] = await Promise.all([
      this.getStatCategories(session, leagueKey),
      this.getUserTeams(session, gameKey).catch((error) => {
        console.warn(`Unable to identify the signed-in Yahoo team for ${leagueKey}: ${error.message}`);
        return [];
      })
    ]);
    const userTeamKeys = userTeams
      .filter((team) => team.leagueKey === leagueKey)
      .map((team) => team.teamKey);
    const requestedWeeks = Array.from(
      { length: Math.max(0, lastWeek - startWeek + 1) },
      (_, index) => startWeek + index
    );
    const weeklyScoreboards = await mapWithConcurrency(requestedWeeks, 4, async (week) => {
      try {
        const data = await this.yahooApi.fetch(session, yahooApiPaths.leagueScoreboard(leagueKey, week), {
          timeoutMs: 8_000,
          retries: 1
        });
        const scoreboard = extractScoreboard(data, statCategories);
        return { ...scoreboard, week: scoreboard.week || week };
      } catch (error) {
        console.warn(`Unable to load Yahoo category strengths for ${leagueKey}, week ${week}: ${error.message}`);
        return { week, matchups: [] };
      }
    });
    return buildCategoryStrengths(weeklyScoreboards, statCategories, userTeamKeys);
  }

  async getStatCategories(session, leagueKey) {
    session.statCategories ||= new Map();
    if (session.statCategories.has(leagueKey)) return session.statCategories.get(leagueKey);

    const data = await this.yahooApi.fetch(session, yahooApiPaths.leagueSettings(leagueKey));
    const categories = extractStatCategories(data);
    session.statCategories.set(leagueKey, categories);
    return categories;
  }
}

function keepRecentSeasons(games, seasonCount = 5) {
  const seasons = games.map((game) => game.season).filter(Number.isFinite);
  if (!seasons.length) return games.slice(0, seasonCount);
  const latestSeason = Math.max(...seasons);
  return games.filter((game) => Number.isFinite(game.season) && game.season >= latestSeason - seasonCount + 1);
}

function isFresh(timestamp, ttlMs) {
  return Number.isFinite(timestamp) && Date.now() - timestamp < ttlMs;
}
