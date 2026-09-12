import { sendJson } from "../utils/http.js";

export function createRouter({ appController, authController, leagueController, pageController }) {
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
    if (handler) return handler(context);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
      return sendJson(res, { error: "Not found" }, 404);
    }
    return pageController.asset(context);
  };
}
