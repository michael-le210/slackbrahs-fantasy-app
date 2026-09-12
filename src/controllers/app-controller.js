import { sendJson } from "../utils/http.js";

export class AppController {
  constructor(config, yahooApi) {
    this.config = config;
    this.yahooApi = yahooApi;
  }

  async session({ res, session }) {
    const signedIn = Boolean(session.token?.accessToken);
    let profile = session.profile || null;
    if (signedIn && !profile && this.yahooApi) {
      try {
        profile = await this.yahooApi.fetchUserInfo(session);
        session.profile = profile;
      } catch (error) {
        console.warn(`Unable to load Yahoo profile: ${error.message}`);
      }
    }

    return sendJson(res, {
      signedIn,
      needsConfig: !this.config.clientId || !this.config.clientSecret,
      profile: profile
        ? {
            name: profile.name || "",
            givenName: profile.given_name || "",
            nickname: profile.nickname || ""
          }
        : null
    });
  }

}
