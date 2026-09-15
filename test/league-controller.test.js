import test from "node:test";
import assert from "node:assert/strict";

import { LeagueController } from "../src/controllers/league-controller.js";

test("rejects week zero before calling Yahoo", async () => {
  let serviceCalled = false;
  const controller = new LeagueController({
    getWeek: async () => {
      serviceCalled = true;
    }
  });
  const res = mockResponse();
  const url = new URL("https://localhost/api/league-week?leagueKey=466.l.123&week=0");

  await controller.showWeek({
    res,
    session: { token: { accessToken: "token" } },
    url
  });

  assert.equal(res.status, 400);
  assert.deepEqual(JSON.parse(res.body), { error: "week must be a positive integer" });
  assert.equal(serviceCalled, false);
});

function mockResponse() {
  return {
    status: 0,
    body: "",
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = body;
    }
  };
}
