import { sendJson } from "../utils/http.js";

export function createRouter({ appController, authController, leagueController, pageController, activityLogger }) {
  const getRoutes = new Map([
    ["/", (context) => pageController.home(context)],
    ["/auth/yahoo", (context) => authController.signIn(context)],
    ["/auth/callback", (context) => authController.callback(context)],
    ["/auth/logout", (context) => authController.logout(context)],
    ["/api/me", (context) => appController.session(context)],
    ["/api/leagues", (context) => leagueController.index(context)],
    ["/api/league-week", (context) => leagueController.showWeek(context)],
    ["/api/league-strengths", (context) => leagueController.strengths(context)]
  ]);

  return async function route(context) {
    const { req, res, url } = context;
    if (req.method !== "GET") return sendJson(res, { error: "Method not allowed" }, 405);

    const handler = getRoutes.get(url.pathname);
    if (handler) {
      const result = await handler(context);
      logRequest(activityLogger, context);
      return result;
    }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
      return sendJson(res, { error: "Not found" }, 404);
    }
    return pageController.asset(context);
  };
}

function logRequest(activityLogger, { req, res, session, url }) {
  const event = requestEvent(url.pathname);
  if (!activityLogger || !event) return;

  void activityLogger.log({
    eventName: event.name,
    route: url.pathname,
    req,
    res,
    session,
    metadata: event.metadata?.(url) || null
  });
}

function requestEvent(pathname) {
  const events = {
    "/": { name: "page_view" },
    "/api/me": { name: "session_checked" },
    "/api/leagues": { name: "leagues_loaded" },
    "/api/league-week": {
      name: "week_loaded",
      metadata: (url) => ({ week: url.searchParams.get("week") || "current" })
    },
    "/api/league-strengths": { name: "strengths_loaded" }
  };
  return events[pathname] || null;
}
