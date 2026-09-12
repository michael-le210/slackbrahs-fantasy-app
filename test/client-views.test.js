import test from "node:test";
import assert from "node:assert/strict";

import { renderComparison } from "../public/client/views/comparison-view.js";
import { renderLeagueAverages } from "../public/client/views/averages-view.js";
import { renderCategoryStrengths } from "../public/client/views/strengths-view.js";
import { filterRecentLeagues } from "../public/client/state.js";

test("renders the comparison view with escaped team names and optional ranks", () => {
  const html = renderComparison(
    {
      categories: [{ id: "fg", name: "FG%", abbreviation: "FG%" }],
      rows: [
        {
          name: "North <Stars>",
          manager: "Mike",
          isMine: true,
          stats: [{ id: "fg", value: ".500", rank: 2, result: null }],
          comparison: null
        }
      ]
    },
    { showRanks: true }
  );

  assert.match(html, /North &lt;Stars&gt;/);
  assert.match(html, /<sup>2nd<\/sup>/);
  assert.match(html, /Your team/);
});

test("keeps counting stats out of the category strengths table", () => {
  const categories = [
    { id: "fgm", name: "FGM", abbreviation: "FGM" },
    { id: "fga", name: "FGA", abbreviation: "FGA" },
    { id: "fg", name: "FG%", abbreviation: "FG%" },
    { id: "ftm", name: "FTM", abbreviation: "FTM" },
    { id: "fta", name: "FTA", abbreviation: "FTA" },
    { id: "ft", name: "FT%", abbreviation: "FT%" }
  ];
  const records = categories.map((category) => ({ id: category.id, wins: 2, losses: 1, ties: 0 }));
  const html = renderCategoryStrengths(
    {
      categories,
      seasonRecord: records,
      weeks: [{ week: 1, records: records.map((record) => ({ ...record, rank: 1 })) }]
    },
    { showRanks: true }
  );

  assert.match(html, />FG%<\/th>/);
  assert.match(html, />FT%<\/th>/);
  assert.doesNotMatch(html, />FGM<\/th>/);
  assert.doesNotMatch(html, />FGA<\/th>/);
  assert.doesNotMatch(html, />FTM<\/th>/);
  assert.doesNotMatch(html, />FTA<\/th>/);
});

test("renders the league average before team averages", () => {
  const html = renderLeagueAverages({
    weeksCompared: 2,
    categories: [
      { id: "fg", name: "FG%", abbreviation: "FG%", sortOrder: 1 },
      { id: "to", name: "TO", abbreviation: "TO", sortOrder: 0 }
    ],
    leagueAverage: [
      { id: "fg", value: 0.475 },
      { id: "to", value: 81.25 }
    ],
    rows: [
      {
        name: "North <Stars>",
        isMine: true,
        stats: [
          { id: "fg", value: 0.5, result: "win" },
          { id: "to", value: 80, result: "win" }
        ]
      }
    ]
  });

  assert.match(html, /League average/);
  assert.match(html, /North &lt;Stars&gt;/);
  assert.ok(html.indexOf("League average") < html.indexOf("North &lt;Stars&gt;"));
  assert.match(html, />.475<\/td>/);
  assert.match(html, />.500<\/td>/);
  assert.match(html, />81<\/td>/);
});

test("renders rounded averages that match the league as neutral", () => {
  const html = renderLeagueAverages({
    weeksCompared: 1,
    categories: [{ id: "ft", name: "FT%", abbreviation: "FT%", sortOrder: 1 }],
    leagueAverage: [{ id: "ft", value: 0.805 }],
    rows: [{
      name: "North Stars",
      isMine: false,
      stats: [{ id: "ft", value: 0.8046, result: "loss" }]
    }]
  });

  assert.match(html, /class="average-value tie"/);
  assert.doesNotMatch(html, /average-value (win|loss)/);
});

test("keeps only the five most recent league seasons", () => {
  const leagues = [1, 2, 3, 4, 5, 6].map((season) => ({ season: 2019 + season }));
  assert.deepEqual(filterRecentLeagues(leagues).map((league) => league.season), [2021, 2022, 2023, 2024, 2025]);
});
