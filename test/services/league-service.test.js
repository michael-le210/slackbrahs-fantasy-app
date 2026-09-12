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
