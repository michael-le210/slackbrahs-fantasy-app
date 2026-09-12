import { AppController } from "./controllers/app-controller.js";
import { AuthController } from "./controllers/auth-controller.js";
import { LeagueController } from "./controllers/league-controller.js";
import { PageController } from "./controllers/page-controller.js";
import { SessionStore } from "./middleware/session-store.js";
import { createRouter } from "./routes/router.js";
import { LeagueService } from "./services/league-service.js";
import { YahooApiService } from "./services/yahoo-api-service.js";
import { sendJson } from "./utils/http.js";

export function createApp(config) {
  const sessionStore = new SessionStore();
  const yahooApi = new YahooApiService(config);
  const leagueService = new LeagueService(yahooApi);
  const route = createRouter({
    appController: new AppController(config, yahooApi),
    authController: new AuthController({ config, yahooApi, sessionStore }),
    leagueController: new LeagueController(leagueService),
    pageController: new PageController(config)
  });

  return async function requestHandler(req, res) {
    try {
      const url = new URL(req.url, `${config.protocol}://${req.headers.host}`);
      const session = sessionStore.get(req, res);
      return await route({ req, res, url, session });
    } catch (error) {
      console.error(error);
      return sendJson(res, { error: error.message || "Unexpected server error" }, error.status || 500);
    }
  };
}
