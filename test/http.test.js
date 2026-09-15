import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { sendFile, serveStatic } from "../src/utils/http.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

test("serves PNG assets with safe no-cache headers", async () => {
  const res = mockResponse();

  await sendFile(res, join(projectRoot, "public", "slackbrahs-icon.png"));

  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "image/png");
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.ok(Buffer.isBuffer(res.body));
});

test("rejects malformed and escaping static asset paths", async () => {
  const malformed = mockResponse();
  const escaping = mockResponse();
  const publicDir = join(projectRoot, "public");

  await serveStatic(malformed, publicDir, "/%E0%A4%A");
  await serveStatic(escaping, publicDir, "/../package.json");

  assert.equal(malformed.status, 400);
  assert.equal(escaping.status, 404);
});

function mockResponse() {
  return {
    headers: {},
    status: 0,
    body: null,
    writeHead(status, headers = {}) {
      this.status = status;
      Object.assign(this.headers, headers);
    },
    end(body) {
      this.body = body;
    }
  };
}
