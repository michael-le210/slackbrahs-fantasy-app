import crypto from "node:crypto";

import { parseCookies, sessionCookie } from "../middleware/session-store.js";
import { redirect, sendHtml } from "../utils/http.js";

const oauthStateCookieName = "yfb_oauth_state";

export class AuthController {
  constructor({ config, yahooApi, sessionStore }) {
    this.config = config;
    this.yahooApi = yahooApi;
    this.sessionStore = sessionStore;
  }

  signIn({ res, session }) {
    if (!this.config.clientId || !this.config.clientSecret) {
      return sendHtml(
        res,
        "<h1>Missing Yahoo credentials</h1><p>Create a .env file from .env.example, then restart the app.</p>",
        500
      );
    }

    session.oauthState = crypto.randomBytes(16).toString("hex");
    appendCookie(res, `${oauthStateCookieName}=${session.oauthState}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    return redirect(res, this.yahooApi.authorizationUrl(session.oauthState));
  }

  async callback({ req, res, session, url }) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const oauthErrorDescription = url.searchParams.get("error_description");
    if (oauthError) {
      return sendHtml(
        res,
        `<h1>Yahoo sign-in was not completed</h1><p>${escapeHtml(oauthErrorDescription || oauthError)}. Return to the app and try again, accepting the requested Yahoo profile permissions.</p>`,
        400
      );
    }

    const cookieState = parseCookies(req.headers.cookie || "")[oauthStateCookieName];
    if (!code || !state || (state !== session.oauthState && state !== cookieState)) {
      return sendHtml(res, "<h1>Invalid Yahoo callback</h1><p>Try signing in again.</p>", 400);
    }

    const token = await this.yahooApi.exchangeAuthorizationCode(code);
    this.yahooApi.saveToken(session, token);
    delete session.oauthState;
    return redirect(res, "/");
  }

  logout({ res, session }) {
    this.sessionStore.destroy(session);
    return redirect(res, "/", { "Set-Cookie": sessionCookie("", 0) });
  }
}

function appendCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader("Set-Cookie", [...cookies, cookie]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
