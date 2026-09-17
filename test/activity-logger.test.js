import test from "node:test";
import assert from "node:assert/strict";

import { ActivityLogger } from "../src/services/activity-logger.js";

test("creates the activity table and records a signed-in event", async () => {
  let schemaSql = "";
  let insertParams;
  const messages = [];
  const pool = {
    query: async (sql) => {
      schemaSql = sql;
    },
    execute: async (sql, params) => {
      insertParams = params;
    }
  };
  const logger = new ActivityLogger({}, pool, {
    warn: (message) => messages.push(message)
  });

  await logger.log({
    eventName: "sign_in",
    route: "/auth/callback",
    req: { method: "GET" },
    res: { statusCode: 302 },
    session: { profile: { sub: "yahoo-user-1", name: "Michael" } }
  });

  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS activity_logs/);
  assert.deepEqual(messages, ["Activity logging connected to MySQL."]);
  assert.deepEqual(insertParams, [
    "sign_in",
    "yahoo-user-1",
    "Michael",
    "/auth/callback",
    "GET",
    302,
    null
  ]);
});

test("does not throw when activity logging is unavailable", async () => {
  const messages = [];
  const logger = new ActivityLogger({}, {
    query: async () => {
      throw new Error("database offline");
    },
    execute: async () => {
      throw new Error("database offline");
    }
  }, {
    warn: (message) => messages.push(message)
  });

  await assert.doesNotReject(() => logger.log({
    eventName: "page_view",
    route: "/",
    req: { method: "GET" },
    res: { statusCode: 200 },
    session: {}
  }));

  assert.deepEqual(messages, ["Activity logging is unavailable: database offline"]);
});

test("reports exactly which MySQL settings are missing", async () => {
  const messages = [];
  const logger = new ActivityLogger({
    mysql: {
      host: "localhost",
      database: "slackbrahs",
      user: "logger"
    }
  }, null, {
    warn: (message) => messages.push(message)
  });

  assert.equal(logger.enabled, false);
  assert.equal(await logger.schemaReady, false);
  assert.deepEqual(messages, ["Activity logging disabled: missing MYSQL_PASSWORD"]);
});
