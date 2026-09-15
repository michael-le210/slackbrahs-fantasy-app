import test from "node:test";
import assert from "node:assert/strict";

import { SessionStore, parseCookies, sessionCookie } from "../src/middleware/session-store.js";

test("creates secure session cookies when HTTPS is enabled", () => {
  const store = new SessionStore({ secure: true });
  const res = mockResponse();

  const session = store.get({ headers: {} }, res);

  assert.equal(session.id.length, 48);
  assert.match(res.headers["Set-Cookie"], /; Secure$/);
  assert.match(res.headers["Set-Cookie"], /HttpOnly; SameSite=Lax/);
});

test("rotates expired sessions instead of returning stale data", () => {
  const store = new SessionStore({ maxAgeSeconds: 60 });
  store.sessions.set("expired-id", {
    id: "expired-id",
    createdAt: Date.now() - 120_000,
    lastAccessedAt: Date.now() - 120_000,
    privateValue: "stale"
  });
  const res = mockResponse();

  const session = store.get({ headers: { cookie: "yfb_session=expired-id" } }, res);

  assert.notEqual(session.id, "expired-id");
  assert.equal(session.privateValue, undefined);
  assert.equal(store.sessions.has("expired-id"), false);
});

test("parses encoded cookie values and can clear a session cookie", () => {
  assert.deepEqual(parseCookies("first=hello%20world; empty="), { first: "hello world", empty: "" });
  assert.match(sessionCookie("", 0, true), /Max-Age=0; Secure$/);
});

test("does not fail a request because of a malformed cookie value", () => {
  assert.deepEqual(parseCookies("broken=%E0%A4%A"), { broken: "%E0%A4%A" });
});

function mockResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
}
