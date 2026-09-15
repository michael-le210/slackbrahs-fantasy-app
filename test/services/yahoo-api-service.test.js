import test from "node:test";
import assert from "node:assert/strict";

import { YahooApiService } from "../../src/services/yahoo-api-service.js";

const baseConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://localhost:3000/auth/callback",
  yahooAuthUrl: "https://api.login.yahoo.com/oauth2/request_auth",
  yahooTokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
  yahooUserInfoUrl: "https://api.login.yahoo.com/openid/v1/userinfo",
  yahooApiBase: "https://fantasysports.yahooapis.com/fantasy/v2",
  yahooRequestTimeoutMs: 10,
  yahooRequestRetries: 0
};

const session = {
  token: {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 60_000
  }
};

test("builds a Yahoo OpenID Connect authorization URL with a nonce", () => {
  const service = new YahooApiService(baseConfig);
  const url = new URL(service.authorizationUrl("state-value", "nonce-value"));

  assert.equal(url.searchParams.get("client_id"), baseConfig.clientId);
  assert.equal(url.searchParams.get("redirect_uri"), baseConfig.redirectUri);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "openid");
  assert.equal(url.searchParams.get("nonce"), "nonce-value");
  assert.equal(url.searchParams.get("state"), "state-value");
});

test("times out when Yahoo stalls while streaming the JSON body", async () => {
  const fetchImpl = async (url, options) => ({
    ok: true,
    status: 200,
    json: () =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
  });
  const service = new YahooApiService(baseConfig, fetchImpl);

  await assert.rejects(
    service.fetch(session, "/users;use_login=1/games;codes=nba/"),
    /Yahoo API timed out after 0 seconds/
  );
});

test("retries a retryable Yahoo response", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return { ok: false, status: 503, json: async () => ({ error: "temporarily unavailable" }) };
    }
    return { ok: true, status: 200, json: async () => ({ fantasy_content: {} }) };
  };
  const service = new YahooApiService({ ...baseConfig, yahooRequestRetries: 1 }, fetchImpl);

  const result = await service.fetch(session, "/test");

  assert.equal(calls, 2);
  assert.deepEqual(result, { fantasy_content: {} });
});

test("fetches Yahoo profile information with the access token", async () => {
  let requestedUrl = "";
  let requestedAuthorization = "";
  const service = new YahooApiService(baseConfig, async (url, options) => {
    requestedUrl = url;
    requestedAuthorization = options.headers.Authorization;
    return {
      ok: true,
      status: 200,
      json: async () => ({ name: "Michael", email: "michael@yahoo.com" })
    };
  });

  const result = await service.fetchUserInfo(session);

  assert.equal(requestedUrl, baseConfig.yahooUserInfoUrl);
  assert.equal(requestedAuthorization, "Bearer access-token");
  assert.deepEqual(result, { name: "Michael", email: "michael@yahoo.com" });
});

test("shares one token refresh across concurrent Yahoo requests", async () => {
  let refreshCalls = 0;
  const service = new YahooApiService(baseConfig, async (url) => {
    assert.equal(url, baseConfig.yahooTokenUrl);
    refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "new-access-token", refresh_token: "new-refresh-token", expires_in: 3600 })
    };
  });
  const expiredSession = {
    token: {
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() - 1
    }
  };

  await Promise.all([
    service.ensureValidToken(expiredSession),
    service.ensureValidToken(expiredSession),
    service.ensureValidToken(expiredSession)
  ]);

  assert.equal(refreshCalls, 1);
  assert.equal(expiredSession.token.accessToken, "new-access-token");
  assert.equal(expiredSession.token.refreshToken, "new-refresh-token");
  assert.equal(expiredSession.tokenRefreshPromise, undefined);
});

test("reports an expired Yahoo session without suggesting an app permission problem", async () => {
  const service = new YahooApiService(baseConfig, async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { description: "Unauthorized" } })
  }));
  const noRefreshSession = {
    token: { accessToken: "expired", expiresAt: Date.now() + 60_000 }
  };

  await assert.rejects(
    service.fetch(noRefreshSession, "/test"),
    (error) => error.status === 401 && /session expired/i.test(error.message) && !/Fantasy Sports Read/.test(error.message)
  );
});
