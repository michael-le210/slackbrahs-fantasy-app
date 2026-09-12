export class YahooApiService {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = config.yahooRequestTimeoutMs || 10_000;
    this.retries = config.yahooRequestRetries ?? 2;
  }

  authorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      language: "en-us",
      scope: "openid",
      state
    });
    return `${this.config.yahooAuthUrl}?${params}`;
  }

  async exchangeAuthorizationCode(code) {
    return this.requestToken(
      new URLSearchParams({
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
        code
      })
    );
  }

  async fetch(session, path, options = {}) {
    if (Date.now() > session.token.expiresAt) await this.refreshToken(session);
    const retries = options.retries ?? this.retries;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.fetchOnce(session, path, timeoutMs, true);
      } catch (error) {
        if (!error.retryable || attempt === retries) throw error;
        console.warn(`Yahoo request stalled for ${path}; retrying (${attempt + 1}/${retries})...`);
        await delay(250 * (attempt + 1));
      }
    }
  }

  async fetchUserInfo(session, allowTokenRefresh = true) {
    if (Date.now() > session.token.expiresAt) await this.refreshToken(session);
    let response;
    let json;

    try {
      ({ response, json } = await fetchJsonWithTimeout(
        this.fetchImpl,
        this.config.yahooUserInfoUrl,
        { headers: { Authorization: `Bearer ${session.token.accessToken}` } },
        this.timeoutMs
      ));
    } catch (cause) {
      throw new Error(
        cause.name === "AbortError"
          ? `Yahoo profile request timed out after ${Math.round(this.timeoutMs / 1000)} seconds`
          : `Yahoo profile request failed: ${cause.message}`
      );
    }

    if (response.status === 401 && session.token.refreshToken && allowTokenRefresh) {
      await this.refreshToken(session);
      return this.fetchUserInfo(session, false);
    }
    if (!response.ok) {
      const message = json?.error_description || json?.error || "Yahoo profile request failed";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return json;
  }

  async fetchOnce(session, path, timeoutMs, allowTokenRefresh) {
    const separator = path.includes("?") ? "&" : "?";
    const requestUrl = `${this.config.yahooApiBase}${path}${separator}format=json`;
    let response;
    let json;

    try {
      ({ response, json } = await fetchJsonWithTimeout(
        this.fetchImpl,
        requestUrl,
        { headers: { Authorization: `Bearer ${session.token.accessToken}` } },
        timeoutMs
      ));
    } catch (cause) {
      const error = new Error(
        cause.name === "AbortError"
          ? `Yahoo API timed out after ${Math.round(timeoutMs / 1000)} seconds`
          : `Yahoo API connection failed: ${cause.message}`
      );
      error.retryable = true;
      throw error;
    }

    if (response.status === 401 && session.token.refreshToken && allowTokenRefresh) {
      await this.refreshToken(session);
      return this.fetchOnce(session, path, timeoutMs, false);
    }
    if (!response.ok) {
      const message = json?.error?.description || json?.error || "Yahoo API request failed";
      const error = new Error(message);
      error.status = response.status;
      error.retryable = response.status === 429 || response.status >= 500;
      if (response.status === 401 || response.status === 403) {
        error.message = `${message}. Check that your Yahoo developer app has Fantasy Sports Read permission.`;
      }
      throw error;
    }
    return json;
  }

  saveToken(session, token) {
    session.token = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || session.token?.refreshToken,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000 - 60_000
    };
  }

  async refreshToken(session) {
    if (!session.token?.refreshToken) throw new Error("Yahoo session expired. Sign in again.");
    const token = await this.requestToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.token.refreshToken
      })
    );
    this.saveToken(session, token);
  }

  async requestToken(body) {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const { response, json } = await fetchJsonWithTimeout(
      this.fetchImpl,
      this.config.yahooTokenUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      },
      this.timeoutMs
    ).catch((cause) => {
      throw new Error(
        cause.name === "AbortError"
          ? `Yahoo sign-in timed out after ${Math.round(this.timeoutMs / 1000)} seconds. Try again.`
          : `Yahoo sign-in failed: ${cause.message}`
        );
    });
    if (!response.ok) throw new Error(json.error_description || json.error || "Yahoo token request failed");
    return json;
  }
}

async function fetchJsonWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    let json;
    try {
      json = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      json = {};
    }
    return { response, json };
  } finally {
    clearTimeout(timeout);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
