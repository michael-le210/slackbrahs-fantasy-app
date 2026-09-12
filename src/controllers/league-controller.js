import { sendJson } from "../utils/http.js";

export class LeagueController {
  constructor(leagueService) {
    this.leagueService = leagueService;
  }

  async index({ res, session }) {
    requireSignedIn(session);
    const leagues = await this.leagueService.listHistoricalH2h(session);
    return sendJson(res, { leagues });
  }

  async showWeek({ res, session, url }) {
    requireSignedIn(session);
    const leagueKey = url.searchParams.get("leagueKey");
    const week = url.searchParams.get("week");

    if (!leagueKey) return sendJson(res, { error: "leagueKey is required" }, 400);
    if (!/^[A-Za-z0-9_-]+\.l\.\d+$/.test(leagueKey)) {
      return sendJson(res, { error: "leagueKey is invalid" }, 400);
    }
    if (week && !/^\d{1,2}$/.test(week)) {
      return sendJson(res, { error: "week must be a positive integer" }, 400);
    }

    const scoreboard = await this.leagueService.getWeek(session, leagueKey, week);
    return sendJson(res, scoreboard);
  }

  async strengths({ res, session, url }) {
    requireSignedIn(session);
    const leagueKey = url.searchParams.get("leagueKey");

    if (!leagueKey) return sendJson(res, { error: "leagueKey is required" }, 400);
    if (!/^[A-Za-z0-9_-]+\.l\.\d+$/.test(leagueKey)) {
      return sendJson(res, { error: "leagueKey is invalid" }, 400);
    }

    const strengths = await this.leagueService.getCategoryStrengths(session, leagueKey);
    return sendJson(res, strengths);
  }
}

function requireSignedIn(session) {
  if (session.token?.accessToken) return;
  const error = new Error("Not signed in");
  error.status = 401;
  throw error;
}
