import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryStrengths,
  buildLeagueAverages,
  buildLeagueComparison,
  extractGames,
  extractLeagues,
  extractScoreboard,
  extractStatCategories,
  extractUserTeams,
  normalizeYahooPayload,
  yahooApiPaths
} from "../../src/models/yahoo-models.js";

test("maps the logged-in user's historical NBA game keys", () => {
  const payload = {
    fantasy_content: {
      users: {
        0: {
          user: [
            { guid: "user-guid" },
            {
              games: {
                0: {
                  game: {
                    game_key: "418",
                    game_id: "418",
                    code: "nba",
                    name: "Basketball",
                    season: "2022",
                    is_game_over: "1",
                    is_offseason: "1"
                  }
                },
                1: {
                  game: {
                    game_key: "428",
                    game_id: "428",
                    code: "nba",
                    name: "Basketball",
                    season: "2023",
                    is_game_over: "1",
                    is_offseason: "1"
                  }
                },
                count: 2
              }
            }
          ]
        },
        count: 1
      }
    }
  };

  assert.deepEqual(extractGames(payload), [
    {
      gameKey: "418",
      gameId: "418",
      code: "nba",
      name: "Basketball",
      season: 2022,
      isGameOver: true,
      isOffseason: true
    },
    {
      gameKey: "428",
      gameId: "428",
      code: "nba",
      name: "Basketball",
      season: 2023,
      isGameOver: true,
      isOffseason: true
    }
  ]);
});

test("normalizes Yahoo numbered collections and disjoint resource fragments", () => {
  const normalized = normalizeYahooPayload({
    teams: {
      0: {
        team: [[{ team_key: "466.l.123.t.1" }, { name: "North Stars" }], { team_stats: { week: "7" } }]
      },
      count: 1
    }
  });

  assert.deepEqual(normalized, {
    teams: {
      team: {
        team_key: "466.l.123.t.1",
        name: "North Stars",
        team_stats: { week: "7" }
      }
    }
  });
});

test("maps league metadata from a fragmented Yahoo response", () => {
  const payload = {
    fantasy_content: {
      users: {
        0: {
          user: [
            { guid: "user-guid" },
            {
              games: {
                0: {
                  game: [
                    { game_key: "466" },
                    {
                      leagues: {
                        0: {
                          league: [
                            {
                              league_key: "466.l.123",
                              league_id: "123",
                              name: "Downtown Hoops",
                              season: "2025",
                              num_teams: "12",
                              scoring_type: "head"
                            },
                            { current_week: "7", start_week: "1", end_week: "20" }
                          ]
                        },
                        count: 1
                      }
                    }
                  ]
                },
                count: 1
              }
            }
          ]
        },
        count: 1
      }
    }
  };

  assert.deepEqual(extractLeagues(payload), [
    {
      leagueKey: "466.l.123",
      leagueId: "123",
      name: "Downtown Hoops",
      season: 2025,
      numTeams: 12,
      scoringType: "head",
      isFinished: false,
      currentWeek: 7,
      startWeek: 1,
      endWeek: 20,
      startDate: "",
      endDate: ""
    }
  ]);
});

test("identifies the signed-in user's teams and their leagues", () => {
  const payload = {
    fantasy_content: {
      users: {
        user: {
          games: {
            game: {
              teams: {
                team: [
                  { team_key: "466.l.123.t.1", league_key: "466.l.123", name: "North Stars" },
                  { team_key: "466.l.456.t.2", name: "City Hoops" }
                ]
              }
            }
          }
        }
      }
    }
  };

  assert.deepEqual(extractUserTeams(payload), [
    { teamKey: "466.l.123.t.1", leagueKey: "466.l.123", name: "North Stars", manager: "" },
    { teamKey: "466.l.456.t.2", leagueKey: "466.l.456", name: "City Hoops", manager: "" }
  ]);
});

test("combines settings categories with fragmented weekly team stats", () => {
  const settingsPayload = {
    fantasy_content: {
      league: [
        { league_key: "466.l.123" },
        {
          settings: {
            stat_categories: {
              stats: {
                0: { stat: { stat_id: "5", display_name: "FG%", enabled: "1", sort_order: "1" } },
                1: { stat: { stat_id: "12", display_name: "REB", enabled: "1", sort_order: "1" } },
                count: 2
              }
            }
          }
        }
      ]
    }
  };
  const scoreboardPayload = {
    fantasy_content: {
      league: [
        { league_key: "466.l.123" },
        {
          scoreboard: {
            week: "7",
            matchups: {
              0: {
                matchup: [
                  {
                    week: "7",
                    week_start: "2025-12-01",
                    week_end: "2025-12-07",
                    status: "postevent",
                    is_playoffs: "0",
                    is_consolation: "0",
                    is_tied: "0",
                    winner_team_key: "466.l.123.t.1"
                  },
                  {
                    teams: {
                      0: {
                        team: [
                          [
                            { team_key: "466.l.123.t.1" },
                            { name: "North Stars" },
                            { managers: [{ manager: { nickname: "Mike" } }] }
                          ],
                          {
                            team_stats: {
                              coverage_type: "week",
                              week: "7",
                              stats: [
                                { stat: { stat_id: "5", value: ".512" } },
                                { stat: { stat_id: "12", value: "245" } }
                              ]
                            }
                          }
                        ]
                      },
                      1: {
                        team: [
                          [{ team_key: "466.l.123.t.2" }, { name: "Lake Effect" }],
                          {
                            team_stats: {
                              stats: [
                                { stat: { stat_id: "5", value: ".498" } },
                                { stat: { stat_id: "12", value: "251" } }
                              ]
                            }
                          }
                        ]
                      },
                      count: 2
                    }
                  }
                ]
              },
              count: 1
            }
          }
        }
      ]
    }
  };

  const categories = extractStatCategories(settingsPayload);
  const scoreboard = extractScoreboard(scoreboardPayload, categories);

  assert.deepEqual(
    categories.map(({ id, name }) => ({ id, name })),
    [
      { id: "5", name: "FG%" },
      { id: "12", name: "REB" }
    ]
  );
  assert.equal(scoreboard.week, 7);
  assert.equal(scoreboard.matchups[0].winnerTeamKey, "466.l.123.t.1");
  assert.equal(scoreboard.matchups[0].teams[0].manager, "Mike");
  assert.deepEqual(scoreboard.matchups[0].teams[0].stats, [
    { id: "5", name: "FG%", abbreviation: "", value: ".512" },
    { id: "12", name: "REB", abbreviation: "", value: "245" }
  ]);
});

test("compares the signed-in team against every league team", () => {
  const scoreboard = {
    matchups: [
      {
        teams: [
          {
            teamKey: "466.l.123.t.1",
            name: "North Stars",
            manager: "Mike",
            stats: [
              { id: "5", name: "FG%", value: ".500" },
              { id: "12", name: "TO", value: "80" }
            ]
          },
          {
            teamKey: "466.l.123.t.2",
            name: "Lake Effect",
            manager: "Alex",
            stats: [
              { id: "5", name: "FG%", value: ".450" },
              { id: "12", name: "TO", value: "90" }
            ]
          }
        ]
      },
      {
        teams: [
          {
            teamKey: "466.l.123.t.3",
            name: "City Hoops",
            stats: [
              { id: "5", name: "FG%", value: ".600" },
              { id: "12", name: "TO", value: "70" }
            ]
          },
          {
            teamKey: "466.l.123.t.4",
            name: "Downtown Ballers",
            stats: [
              { id: "5", name: "FG%", value: ".500" },
              { id: "12", name: "TO", value: "80" }
            ]
          }
        ]
      }
    ]
  };
  const categories = [
    { id: "5", name: "FG%", abbreviation: "FG%", sortOrder: 1 },
    { id: "12", name: "TO", abbreviation: "TO", sortOrder: 0 }
  ];

  const comparison = buildLeagueComparison(scoreboard, categories, ["466.l.123.t.1"]);
  const northStars = comparison.rows[0];
  const lakeEffect = comparison.rows[1];

  assert.equal(comparison.myTeamKey, "466.l.123.t.1");
  assert.deepEqual(comparison.rows.map((row) => row.teamKey), [
    "466.l.123.t.1",
    "466.l.123.t.2",
    "466.l.123.t.3",
    "466.l.123.t.4"
  ]);
  assert.deepEqual(northStars.stats.map(({ rank, result }) => ({ rank, result })), [
    { rank: 2, result: null },
    { rank: 2, result: null }
  ]);
  assert.deepEqual(lakeEffect.stats.map(({ rank, result }) => ({ rank, result })), [
    { rank: 4, result: "win" },
    { rank: 4, result: "win" }
  ]);
  assert.deepEqual(lakeEffect.comparison, { wins: 2, losses: 0, ties: 0 });
});

test("builds weekly category strengths against every team in the league", () => {
  const categories = [
    { id: "5", name: "FG%", abbreviation: "FG%", sortOrder: 1 },
    { id: "12", name: "TO", abbreviation: "TO", sortOrder: 0 }
  ];
  const teams = [
    { teamKey: "466.l.123.t.1", name: "North Stars", stats: [{ id: "5", value: ".500" }, { id: "12", value: "80" }] },
    { teamKey: "466.l.123.t.2", name: "Lake Effect", stats: [{ id: "5", value: ".450" }, { id: "12", value: "90" }] },
    { teamKey: "466.l.123.t.3", name: "City Hoops", stats: [{ id: "5", value: ".600" }, { id: "12", value: "70" }] },
    { teamKey: "466.l.123.t.4", name: "Downtown Ballers", stats: [{ id: "5", value: ".400" }, { id: "12", value: "85" }] }
  ];
  const weekTwoTeams = teams.map((team) => ({
    ...team,
    stats: team.stats.map((stat) => ({ ...stat, value: stat.id === "5" ? { "466.l.123.t.1": ".500", "466.l.123.t.2": ".500", "466.l.123.t.3": ".400", "466.l.123.t.4": ".600" }[team.teamKey] : { "466.l.123.t.1": "80", "466.l.123.t.2": "75", "466.l.123.t.3": "90", "466.l.123.t.4": "70" }[team.teamKey] }))
  }));

  const result = buildCategoryStrengths(
    [
      { week: 1, matchups: [{ teams }] },
      { week: 2, matchups: [{ teams: weekTwoTeams }] }
    ],
    categories,
    ["466.l.123.t.1"]
  );

  assert.equal(result.myTeamKey, "466.l.123.t.1");
  assert.deepEqual(result.weeks.map((week) => week.week), [1, 2]);
  assert.deepEqual(result.weeks[0].records.map(({ id, wins, losses, ties, rank }) => ({ id, wins, losses, ties, rank })), [
    { id: "5", wins: 2, losses: 1, ties: 0, rank: 2 },
    { id: "12", wins: 2, losses: 1, ties: 0, rank: 2 }
  ]);
  assert.deepEqual(result.weeks[1].records.map(({ id, wins, losses, ties, rank }) => ({ id, wins, losses, ties, rank })), [
    { id: "5", wins: 1, losses: 1, ties: 1, rank: 2 },
    { id: "12", wins: 1, losses: 2, ties: 0, rank: 3 }
  ]);
  assert.deepEqual(result.seasonRecord, [
    { id: "5", wins: 3, losses: 2, ties: 1 },
    { id: "12", wins: 3, losses: 3, ties: 0 }
  ]);
});

test("builds team averages against the league average", () => {
  const categories = [
    { id: "5", name: "FG%", abbreviation: "FG%", sortOrder: 1 },
    { id: "12", name: "TO", abbreviation: "TO", sortOrder: 0 }
  ];
  const teams = [
    { teamKey: "466.l.123.t.1", name: "North Stars", stats: [{ id: "5", value: ".500" }, { id: "12", value: "80" }] },
    { teamKey: "466.l.123.t.2", name: "Lake Effect", stats: [{ id: "5", value: ".450" }, { id: "12", value: "90" }] }
  ];
  const secondWeek = teams.map((team) => ({
    ...team,
    stats: team.stats.map((stat) => ({
      ...stat,
      value: stat.id === "5" ? (team.teamKey.endsWith(".1") ? ".500" : ".500") : team.teamKey.endsWith(".1") ? "80" : "75"
    }))
  }));

  const result = buildLeagueAverages(
    [
      { week: 1, matchups: [{ teams }] },
      { week: 2, matchups: [{ teams: secondWeek }] }
    ],
    categories,
    ["466.l.123.t.1"]
  );

  assert.equal(result.weeksCompared, 2);
  assert.deepEqual(result.leagueAverage.map(({ id, value }) => ({ id, value })), [
    { id: "5", value: 0.4875 },
    { id: "12", value: 81.25 }
  ]);
  assert.deepEqual(result.rows.map((row) => row.teamKey), ["466.l.123.t.1", "466.l.123.t.2"]);
  assert.deepEqual(result.rows[0].stats.map(({ id, value, result: comparison }) => ({ id, value, result: comparison })), [
    { id: "5", value: 0.5, result: "win" },
    { id: "12", value: 80, result: "win" }
  ]);
});

test("builds the yfpy-referenced settings and scoreboard paths", () => {
  assert.equal(yahooApiPaths.userNbaGames, "/users;use_login=1/games;codes=nba/");
  assert.equal(
    yahooApiPaths.userLeaguesByGameKey("428"),
    "/users;use_login=1/games;game_keys=428/leagues/"
  );
  assert.equal(
    yahooApiPaths.userTeamsByGameKey("428"),
    "/users;use_login=1/games;game_keys=428/teams/"
  );
  assert.equal(yahooApiPaths.leagueSettings("466.l.123"), "/league/466.l.123/settings");
  assert.equal(yahooApiPaths.leagueScoreboard("466.l.123", "7"), "/league/466.l.123/scoreboard;week=7");
});
