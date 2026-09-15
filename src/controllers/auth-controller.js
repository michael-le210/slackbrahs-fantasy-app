import crypto from "node:crypto";

import { parseCookies } from "../middleware/session-store.js";
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
    session.oauthNonce = crypto.randomBytes(24).toString("base64url");
    appendCookie(res, oauthStateCookie(session.oauthState, 600, this.secureCookies));
    return redirect(res, this.yahooApi.authorizationUrl(session.oauthState, session.oauthNonce));
  }

  async callback({ req, res, session, url }) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const oauthErrorDescription = url.searchParams.get("error_description");
    if (oauthError) {
      delete session.oauthState;
      delete session.oauthNonce;
      appendCookie(res, oauthStateCookie("", 0, this.secureCookies));
      return sendHtml(
        res,
        `<h1>Yahoo sign-in was not completed</h1><p>${escapeHtml(oauthErrorDescription || oauthError)}. Return to the app and try again.</p>`,
        400
      );
    }

    const cookieState = parseCookies(req.headers.cookie || "")[oauthStateCookieName];
    if (!code || !state || (state !== session.oauthState && state !== cookieState)) {
      delete session.oauthState;
      delete session.oauthNonce;
      appendCookie(res, oauthStateCookie("", 0, this.secureCookies));
      return sendHtml(res, "<h1>Invalid Yahoo callback</h1><p>Try signing in again.</p>", 400);
    }

    const token = await this.yahooApi.exchangeAuthorizationCode(code);
    this.yahooApi.saveToken(session, token);
    delete session.oauthState;
    delete session.oauthNonce;
    appendCookie(res, oauthStateCookie("", 0, this.secureCookies));
    return redirect(res, "/");
  }

  logout({ res, session }) {
    this.sessionStore.destroy(session);
    return redirect(res, "/", {
      "Set-Cookie": [
        this.sessionStore.cookie("", 0),
        oauthStateCookie("", 0, this.secureCookies)
      ]
    });
  }

  get secureCookies() {
    return this.config.secureCookies ?? this.config.protocol === "https";
  }
}

function oauthStateCookie(value, maxAge, secure) {
  return `${oauthStateCookieName}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
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
