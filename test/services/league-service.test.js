import test from "node:test";
import assert from "node:assert/strict";

import { LeagueService } from "../../src/services/league-service.js";

const leagueKey = "466.l.123";
const gameKey = "466";

test("finds the signed-in manager before a week is loaded", async () => {
  const yahooApi = {
    fetch: async (_session, path) => {
      assert.equal(path, `/users;use_login=1/games;game_keys=${gameKey}/teams/`);
      return {
        fantasy_content: {
          users: {
            user: {
              games: {
                game: {
                  teams: {
                    team: {
                      team_key: "466.l.123.t.1",
                      league_key: leagueKey,
                      managers: [{ manager: { nickname: "Michael" } }]
                    }
                  }
                }
              }
            }
          }
        }
      };
    }
  };
  const service = new LeagueService(yahooApi);
  const session = { token: { accessToken: "token", expiresAt: Date.now() + 60_000 } };

  const manager = await service.getSignedInManager(session, [{ leagueKey }]);

  assert.equal(manager, "Michael");
  assert.equal(session.myTeamManager, "Michael");
});

test("adds a league-wide comparison to the weekly response", async () => {
  const responses = new Map([
    [
      `/league/${leagueKey}/scoreboard;week=7`,
      {
        fantasy_content: {
          league: {
            scoreboard: {
              week: "7",
              matchups: {
                0: {
                  matchup: {
                    week: "7",
                    teams: {
                      0: {
                        team: {
                          team_key: "466.l.123.t.1",
                          name: "North Stars",
                          team_stats: {
                            stats: {
                              0: { stat: { stat_id: "5", value: ".500" } },
                              1: { stat: { stat_id: "12", value: "80" } }
                            }
                          }
                        }
                      },
                      1: {
                        team: {
                          team_key: "466.l.123.t.2",
                          name: "Lake Effect",
                          team_stats: {
                            stats: {
                              0: { stat: { stat_id: "5", value: ".450" } },
                              1: { stat: { stat_id: "12", value: "90" } }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ],
    [
      `/league/${leagueKey}/settings`,
      {
        fantasy_content: {
          league: {
            settings: {
              stat_categories: {
                stats: {
                  0: { stat: { stat_id: "5", display_name: "FG%", sort_order: "1", enabled: "1" } },
                  1: { stat: { stat_id: "12", display_name: "TO", sort_order: "0", enabled: "1" } }
                }
              }
            }
          }
        }
      }
    ],
    [
      `/users;use_login=1/games;game_keys=${gameKey}/teams/`,
      {
        fantasy_content: {
          users: {
            user: {
              games: {
                game: {
                  teams: {
                    team: {
                      team_key: "466.l.123.t.1",
                      league_key: leagueKey,
                      name: "North Stars"
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  ]);
  const yahooApi = {
    fetch: async (_session, path) => {
      const response = responses.get(path);
      if (!response) throw new Error(`Unexpected Yahoo path: ${path}`);
      return response;
    }
  };
  const service = new LeagueService(yahooApi);
  const result = await service.getWeek({ token: { accessToken: "token", expiresAt: Date.now() + 60_000 } }, leagueKey, "7");

  assert.equal(result.comparison.myTeamKey, "466.l.123.t.1");
  assert.deepEqual(result.comparison.rows.map((row) => row.name), ["North Stars", "Lake Effect"]);
  assert.deepEqual(result.comparison.rows[1].comparison, { wins: 2, losses: 0, ties: 0 });
});

test("requests leagues only for the five most recent NBA seasons", async () => {
  const requestedPaths = [];
  const games = Array.from({ length: 6 }, (_, index) => {
    const season = 2020 + index;
    return { game_key: String(400 + index), code: "nba", season: String(season) };
  });
  const yahooApi = {
    fetch: async (_session, path) => {
      requestedPaths.push(path);
      if (path === "/users;use_login=1/games;codes=nba/") return { games: { game: games } };
      const gameKey = path.match(/game_keys=([^/]+)/)?.[1];
      const season = 2020 + (Number(gameKey) - 400);
      return {
        league: {
          league_key: `${gameKey}.l.1`,
          name: `League ${season}`,
          season: String(season),
          scoring_type: "head"
        }
      };
    }
  };
  const service = new LeagueService(yahooApi);
  const testSession = {};

  const leagues = await service.listHistoricalH2h(testSession);
  await service.listHistoricalH2h(testSession);

  assert.deepEqual(leagues.map((league) => league.season), [2025, 2024, 2023, 2022, 2021]);
  assert.equal(requestedPaths.filter((path) => path === "/users;use_login=1/games;codes=nba/").length, 1);
  assert.equal(requestedPaths.some((path) => path.includes("game_keys=400")), false);
  assert.equal(requestedPaths.length, 6);
});

test("deduplicates and caches simultaneous category strength requests", async () => {
  const service = new LeagueService({}, { cacheTtlMs: 60_000 });
  const result = { weeks: [{ week: 1 }] };
  let loadCalls = 0;
  service.loadCategoryStrengths = async () => {
    loadCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return result;
  };
  const testSession = {};

  const [first, second] = await Promise.all([
    service.getCategoryStrengths(testSession, leagueKey),
    service.getCategoryStrengths(testSession, leagueKey)
  ]);
  const cached = await service.getCategoryStrengths(testSession, leagueKey);

  assert.strictEqual(first, result);
  assert.strictEqual(second, result);
  assert.strictEqual(cached, result);
  assert.equal(loadCalls, 1);
});
