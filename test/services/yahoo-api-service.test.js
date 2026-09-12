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
