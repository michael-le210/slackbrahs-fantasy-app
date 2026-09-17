import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

loadEnv(join(projectRoot, ".env"));

const certFile = resolveConfigPath(process.env.SSL_CERT_FILE, ".certs/localhost.crt");
const keyFile = resolveConfigPath(process.env.SSL_KEY_FILE, ".certs/localhost.key");
const host = process.env.HOST || "localhost";
const port = readInteger("PORT", 3000, 1, 65_535);
const protocol = existsSync(certFile) && existsSync(keyFile) ? "https" : "http";
const redirectUri = process.env.YAHOO_REDIRECT_URI || `${protocol}://${host}:${port}/auth/callback`;
const secureCookies = protocol === "https" || redirectUri.startsWith("https://");

export const config = Object.freeze({
  projectRoot,
  publicDir: join(projectRoot, "public"),
  viewsDir: join(projectRoot, "src", "views"),
  clientId: process.env.YAHOO_CLIENT_ID,
  clientSecret: process.env.YAHOO_CLIENT_SECRET,
  redirectUri,
  secureCookies,
  host,
  port,
  certFile,
  keyFile,
  protocol,
  yahooAuthUrl: "https://api.login.yahoo.com/oauth2/request_auth",
  yahooTokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
  yahooUserInfoUrl: "https://api.login.yahoo.com/openid/v1/userinfo",
  yahooApiBase: "https://fantasysports.yahooapis.com/fantasy/v2",
  yahooRequestTimeoutMs: readInteger("YAHOO_REQUEST_TIMEOUT_MS", 10_000, 1_000, 60_000),
  yahooRequestRetries: readInteger("YAHOO_REQUEST_RETRIES", 2, 0, 5),
  mysql: Object.freeze({
    host: process.env.MYSQL_HOST,
    port: readInteger("MYSQL_PORT", 3306, 1, 65_535),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectionLimit: readInteger("MYSQL_CONNECTION_LIMIT", 5, 1, 20)
  })
});

function readInteger(name, fallback, minimum, maximum) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function resolveConfigPath(value, fallback) {
  return resolve(projectRoot, value || fallback);
}

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
