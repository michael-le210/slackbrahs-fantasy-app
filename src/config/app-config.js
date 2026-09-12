import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnv(join(projectRoot, ".env"));

const certFile = process.env.SSL_CERT_FILE || join(projectRoot, ".certs", "localhost.crt");
const keyFile = process.env.SSL_KEY_FILE || join(projectRoot, ".certs", "localhost.key");

export const config = Object.freeze({
  projectRoot,
  publicDir: join(projectRoot, "public"),
  viewsDir: join(projectRoot, "src", "views"),
  clientId: process.env.YAHOO_CLIENT_ID,
  clientSecret: process.env.YAHOO_CLIENT_SECRET,
  redirectUri: process.env.YAHOO_REDIRECT_URI || "https://localhost:3000/auth/callback",
  host: process.env.HOST || "localhost",
  port: Number(process.env.PORT || 3000),
  certFile,
  keyFile,
  protocol: existsSync(certFile) && existsSync(keyFile) ? "https" : "http",
  yahooAuthUrl: "https://api.login.yahoo.com/oauth2/request_auth",
  yahooTokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
  yahooUserInfoUrl: "https://api.login.yahoo.com/openid/v1/userinfo",
  yahooApiBase: "https://fantasysports.yahooapis.com/fantasy/v2",
  yahooRequestTimeoutMs: Number(process.env.YAHOO_REQUEST_TIMEOUT_MS || 10_000),
  yahooRequestRetries: Number(process.env.YAHOO_REQUEST_RETRIES || 2)
});

function loadEnv(envPath) {
  try {
    if (!existsSync(envPath)) return;
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Environment variables supplied by the shell remain available as a fallback.
  }
}
