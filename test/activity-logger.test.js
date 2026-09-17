import test from "node:test";
import assert from "node:assert/strict";

import { ActivityLogger } from "../src/services/activity-logger.js";

test("creates the activity table and records a signed-in event", async () => {
  let schemaSql = "";
  let insertParams;
  const pool = {
    query: async (sql) => {
      schemaSql = sql;
    },
    execute: async (sql, params) => {
      insertParams = params;
    }
  };
  const logger = new ActivityLogger({}, pool);

  await logger.log({
    eventName: "sign_in",
    route: "/auth/callback",
    req: { method: "GET" },
    res: { statusCode: 302 },
    session: { profile: { sub: "yahoo-user-1", name: "Michael" } }
  });

  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS activity_logs/);
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
  const logger = new ActivityLogger({}, {
    query: async () => {
      throw new Error("database offline");
    },
    execute: async () => {
      throw new Error("database offline");
    }
  });

  await assert.doesNotReject(() => logger.log({
    eventName: "page_view",
    route: "/",
    req: { method: "GET" },
    res: { statusCode: 200 },
    session: {}
  }));
});

