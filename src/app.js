import { AppController } from "./controllers/app-controller.js";
import { AuthController } from "./controllers/auth-controller.js";
import { LeagueController } from "./controllers/league-controller.js";
import { PageController } from "./controllers/page-controller.js";
import { SessionStore } from "./middleware/session-store.js";
import { createRouter } from "./routes/router.js";
import { LeagueService } from "./services/league-service.js";
import { ActivityLogger } from "./services/activity-logger.js";
import { YahooApiService } from "./services/yahoo-api-service.js";
import { sendJson } from "./utils/http.js";

export function createApp(config) {
  const sessionStore = new SessionStore({ secure: config.secureCookies ?? config.protocol === "https" });
  const yahooApi = new YahooApiService(config);
  const leagueService = new LeagueService(yahooApi);
  const activityLogger = new ActivityLogger(config);
  const route = createRouter({
    appController: new AppController(config, yahooApi),
    authController: new AuthController({ config, yahooApi, sessionStore, activityLogger }),
    leagueController: new LeagueController(leagueService),
    pageController: new PageController(config),
    activityLogger
  });

  return async function requestHandler(req, res) {
    try {
      const url = new URL(req.url, `${config.protocol}://${req.headers.host}`);
      const session = sessionStore.get(req, res);
      return await route({ req, res, url, session });
    } catch (error) {
      if (!error.status || error.status >= 500) console.error(error);
      return sendJson(res, { error: error.message || "Unexpected server error" }, error.status || 500);
    }
  };
}
