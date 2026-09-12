// Yahoo represents resources as a mix of numbered collections and arrays of
// non-overlapping object fragments. This normalizer follows the same strategy
// used by yfpy: collapse numbered collections and merge disjoint fragments
// before mapping them into the small models consumed by this app.

export const yahooApiPaths = {
  userNbaGames: "/users;use_login=1/games;codes=nba/",
  userLeaguesByGameKey: (gameKey) => `/users;use_login=1/games;game_keys=${encodeURIComponent(gameKey)}/leagues/`,
  userTeamsByGameKey: (gameKey) => `/users;use_login=1/games;game_keys=${encodeURIComponent(gameKey)}/teams/`,
  leagueSettings: (leagueKey) => `/league/${leagueKey}/settings`,
  leagueScoreboard: (leagueKey, week) =>
    week ? `/league/${leagueKey}/scoreboard;week=${encodeURIComponent(week)}` : `/league/${leagueKey}/scoreboard`
};

export function extractGames(payload) {
  const normalized = normalizeYahooPayload(payload);
  const games = collectPropertyValues(normalized, "game")
    .flatMap(toArray)
    .map((item) => unwrap(item, "game"))
    .filter((game) => isPlainObject(game) && game.game_key)
    .map((game) => ({
      gameKey: String(game.game_key),
      gameId: stringValue(game.game_id),
      code: stringValue(game.code),
      name: stringValue(game.name),
      season: numberValue(game.season),
      isGameOver: yahooBoolean(game.is_game_over),
      isOffseason: yahooBoolean(game.is_offseason)
    }));

  return uniqueBy(games, "gameKey");
}

export function normalizeYahooPayload(value) {
  if (Array.isArray(value)) {
    const items = value.map(normalizeYahooPayload).filter(hasContent);
    if (items.length === 0) return [];
    if (items.length === 1) return items[0];

    const merged = mergeDisjointObjects(items);
    return merged || items;
  }

  if (!isPlainObject(value)) return value;

  const keys = Object.keys(value);
  const numberedKeys = keys.filter(isNumberedKey).sort((a, b) => Number(a) - Number(b));
  const dataKeys = keys.filter((key) => key !== "count" && !isNumberedKey(key));

  if (numberedKeys.length && dataKeys.length === 0) {
    const items = numberedKeys.map((key) => normalizeYahooPayload(value[key])).filter(hasContent);
    return items.length === 1 ? items[0] : items;
  }

  const normalized = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "count" && numberedKeys.length) continue;
    normalized[key] = normalizeYahooPayload(child);
  }

  if (normalized["0"] && !normalized["1"] && isPlainObject(normalized["0"])) {
    const first = normalized["0"];
    delete normalized["0"];
    const merged = mergeDisjointObjects([first, normalized]);
    if (merged) return merged;
    normalized["0"] = first;
  }

  return normalized;
}

export function extractLeagues(payload) {
  const normalized = normalizeYahooPayload(payload);
  const leagues = collectPropertyValues(normalized, "league")
    .flatMap(toArray)
    .map((item) => unwrap(item, "league"))
    .filter((league) => isPlainObject(league) && league.league_key && league.name)
    .map((league) => ({
      leagueKey: String(league.league_key),
      leagueId: stringValue(league.league_id),
      name: stringValue(league.name),
      season: numberValue(league.season),
      numTeams: numberValue(league.num_teams),
      scoringType: stringValue(league.scoring_type),
      isFinished: yahooBoolean(league.is_finished),
      currentWeek: numberValue(league.current_week),
      startWeek: numberValue(league.start_week),
      endWeek: numberValue(league.end_week),
      startDate: stringValue(league.start_date),
      endDate: stringValue(league.end_date)
    }));

  return uniqueBy(leagues, "leagueKey");
}

export function extractUserTeams(payload) {
  const normalized = normalizeYahooPayload(payload);
  const teams = collectPropertyValues(normalized, "team")
    .flatMap(toArray)
    .map((item) => unwrap(item, "team"))
    .filter((team) => isPlainObject(team) && team.team_key)
    .map((team) => {
      const teamKey = String(team.team_key);
      const manager = resourceList(team.managers, "manager")[0] || {};
      return {
        teamKey,
        leagueKey: stringValue(team.league_key) || teamKey.replace(/\.t\.\d+$/, ""),
        name: stringValue(team.name),
        manager: stringValue(manager.nickname || manager.guid)
      };
    });

  return uniqueBy(teams, "teamKey");
}

export function extractStatCategories(payload) {
  const normalized = normalizeYahooPayload(payload);
  const settings = findFirstProperty(normalized, "settings") || normalized;
  const statCategories = findFirstProperty(settings, "stat_categories");
  const stats = resourceList(statCategories?.stats, "stat");

  return stats
    .filter((stat) => isPlainObject(stat) && stat.stat_id !== undefined)
    .map((stat, index) => ({
      id: String(stat.stat_id),
      name: stringValue(stat.display_name || stat.name || stat.abbr || stat.stat_id),
      abbreviation: stringValue(stat.abbr),
      enabled: stat.enabled === undefined ? true : yahooBoolean(stat.enabled),
      sortOrder: numberValue(stat.sort_order),
      displayOrder: index
    }))
    .filter((stat) => stat.enabled);
}

export function extractScoreboard(payload, statCategories = []) {
  const normalized = normalizeYahooPayload(payload);
  const scoreboard = findFirstProperty(normalized, "scoreboard") || {};
  const statLookup = new Map(statCategories.map((stat) => [String(stat.id), stat]));
  const matchups = resourceList(scoreboard.matchups, "matchup")
    .filter(isPlainObject)
    .map((matchup, index) => mapMatchup(matchup, index, statLookup));

  return {
    week: numberValue(scoreboard.week) || matchups.find((matchup) => matchup.week)?.week || null,
    matchups: matchups.filter((matchup) => matchup.teams.length)
  };
}

export function buildLeagueComparison(scoreboard, statCategories = [], userTeamKeys = []) {
  const teams = uniqueBy(scoreboard.matchups.flatMap((matchup) => matchup.teams), "teamKey");
  const categories = statCategories.length ? statCategories : inferStatCategories(teams);
  const userKeys = new Set(userTeamKeys.map(String));
  const myTeam = teams.find((team) => userKeys.has(team.teamKey));

  const rows = teams.map((team) => {
    const isMine = userKeys.has(team.teamKey);
    const stats = categories.map((category) => {
      const stat = team.stats.find((item) => item.id === String(category.id));
      const value = stat?.value ?? "-";
      return {
        id: String(category.id),
        name: category.name,
        abbreviation: category.abbreviation || "",
        value,
        rank: rankFor(value, teams, category),
        result: null
      };
    });

    let comparison = null;
    if (myTeam && !isMine) {
      let wins = 0;
      let losses = 0;
      let ties = 0;
      const myStats = new Map(myTeam.stats.map((stat) => [stat.id, stat]));

      for (const stat of stats) {
        const category = categories.find((item) => String(item.id) === stat.id);
        const result = compareCategoryValues(myStats.get(stat.id)?.value, stat.value, category);
        stat.result = result;
        if (result === "win") wins += 1;
        if (result === "loss") losses += 1;
        if (result === "tie") ties += 1;
      }
      comparison = { wins, losses, ties };
    }

    return {
      ...team,
      isMine,
      stats,
      comparison
    };
  });

  return {
    myTeamKey: myTeam?.teamKey || null,
    categories: categories.map(({ id, name, abbreviation, sortOrder }) => ({
      id: String(id),
      name,
      abbreviation: abbreviation || "",
      sortOrder
    })),
    rows: rows.sort((a, b) => Number(b.isMine) - Number(a.isMine))
  };
}

export function buildCategoryStrengths(weeklyScoreboards, statCategories = [], userTeamKeys = []) {
  const userKeys = new Set(userTeamKeys.map(String));
  const allTeams = weeklyScoreboards.flatMap((scoreboard) => scoreboard.matchups.flatMap((matchup) => matchup.teams));
  const categories = statCategories.length ? statCategories : inferStatCategories(uniqueBy(allTeams, "teamKey"));
  const weeks = [];
  let myTeamKey = null;
  let myTeamManager = "";

  for (const scoreboard of weeklyScoreboards) {
    const teams = uniqueBy(scoreboard.matchups.flatMap((matchup) => matchup.teams), "teamKey");
    const myTeam = teams.find((team) => userKeys.has(team.teamKey));
    if (myTeam) myTeamKey ||= myTeam.teamKey;
    if (myTeam?.manager) myTeamManager ||= myTeam.manager;
    if (!myTeam || teams.length < 2) continue;

    const records = categories.map((category) => {
      const teamRecords = teams.map((team) => ({
        teamKey: team.teamKey,
        record: categoryRecordForTeam(team, teams, category)
      }));
      const record = teamRecords.find((item) => item.teamKey === myTeam.teamKey)?.record;
      const safeRecord = record || { wins: null, losses: null, ties: null };
      return {
        id: String(category.id),
        ...safeRecord,
        rank: rankForCategoryRecord(record, teamRecords)
      };
    });

    weeks.push({
      week: scoreboard.week,
      records
    });
  }

  const seasonRecord = categories.map((category) => {
    const totals = weeks.reduce(
      (total, week) => {
        const record = week.records.find((item) => item.id === String(category.id));
        if (!record || record.wins === null || record.wins === undefined) return total;
        total.wins += record.wins;
        total.losses += record.losses;
        total.ties += record.ties;
        total.compared += 1;
        return total;
      },
      { wins: 0, losses: 0, ties: 0, compared: 0 }
    );
    return {
      id: String(category.id),
      wins: totals.compared ? totals.wins : null,
      losses: totals.compared ? totals.losses : null,
      ties: totals.compared ? totals.ties : null
    };
  });

  return {
    myTeamKey,
    myTeamManager,
    categories: categories.map(({ id, name, abbreviation, sortOrder }) => ({
      id: String(id),
      name,
      abbreviation: abbreviation || "",
      sortOrder
    })),
    seasonRecord,
    weeks,
    averages: buildLeagueAverages(weeklyScoreboards, categories, userTeamKeys)
  };
}

export function buildLeagueAverages(weeklyScoreboards, statCategories = [], userTeamKeys = []) {
  const userKeys = new Set(userTeamKeys.map(String));
  const allTeams = weeklyScoreboards.flatMap((scoreboard) =>
    scoreboard.matchups.flatMap((matchup) => matchup.teams)
  );
  const categories = statCategories.length ? statCategories : inferStatCategories(uniqueBy(allTeams, "teamKey"));
  const teamAggregates = new Map();

  for (const scoreboard of weeklyScoreboards) {
    const teams = uniqueBy(scoreboard.matchups.flatMap((matchup) => matchup.teams), "teamKey");
    for (const team of teams) {
      if (!teamAggregates.has(team.teamKey)) {
        teamAggregates.set(team.teamKey, {
          team,
          totals: new Map()
        });
      }

      const aggregate = teamAggregates.get(team.teamKey);
      for (const category of categories) {
        const value = numericValue(team.stats.find((stat) => stat.id === String(category.id))?.value);
        if (value === null) continue;
        const total = aggregate.totals.get(String(category.id)) || { sum: 0, count: 0 };
        total.sum += value;
        total.count += 1;
        aggregate.totals.set(String(category.id), total);
      }
    }
  }

  const rows = [...teamAggregates.values()].map(({ team, totals }) => {
    const stats = categories.map((category) => {
      const total = totals.get(String(category.id));
      return {
        id: String(category.id),
        name: category.name,
        abbreviation: category.abbreviation || "",
        value: total ? total.sum / total.count : null
      };
    });
    return {
      ...team,
      isMine: userKeys.has(team.teamKey),
      stats
    };
  });

  const leagueAverage = categories.map((category) => {
    const values = rows
      .map((row) => row.stats.find((stat) => stat.id === String(category.id))?.value)
      .filter((value) => value !== null && value !== undefined);
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return {
      id: String(category.id),
      name: category.name,
      abbreviation: category.abbreviation || "",
      value: average
    };
  });

  for (const row of rows) {
    for (const stat of row.stats) {
      const category = categories.find((item) => String(item.id) === stat.id);
      const leagueStat = leagueAverage.find((item) => item.id === stat.id);
      stat.result = compareCategoryValues(stat.value, leagueStat?.value, category);
    }
  }

  return {
    weeksCompared: weeklyScoreboards.filter((scoreboard) => scoreboard.matchups.some((matchup) => matchup.teams.length)).length,
    categories: categories.map(({ id, name, abbreviation, sortOrder }) => ({
      id: String(id),
      name,
      abbreviation: abbreviation || "",
      sortOrder
    })),
    leagueAverage,
    rows: rows.sort((a, b) => Number(b.isMine) - Number(a.isMine))
  };
}

function mapMatchup(matchup, index, statLookup) {
  const week = numberValue(matchup.week);
  const teams = uniqueBy(
    resourceList(matchup.teams, "team")
      .filter((team) => isPlainObject(team) && team.team_key && team.name)
      .map((team) => mapTeam(team, statLookup)),
    "teamKey"
  );

  return {
    id: `${week || "week"}-${index}`,
    week,
    status: stringValue(matchup.status),
    weekStart: stringValue(matchup.week_start),
    weekEnd: stringValue(matchup.week_end),
    winnerTeamKey: stringValue(matchup.winner_team_key),
    isTied: yahooBoolean(matchup.is_tied),
    isPlayoffs: yahooBoolean(matchup.is_playoffs),
    isConsolation: yahooBoolean(matchup.is_consolation),
    teams
  };
}

function mapTeam(team, statLookup) {
  const manager = resourceList(team.managers, "manager")[0] || {};
  const stats = resourceList(team.team_stats?.stats, "stat")
    .filter((stat) => isPlainObject(stat) && stat.stat_id !== undefined)
    .map((stat, index) => {
      const category = statLookup.get(String(stat.stat_id));
      return {
        id: String(stat.stat_id),
        name: category?.name || String(stat.stat_id),
        abbreviation: category?.abbreviation || "",
        value: stat.value ?? "-",
        displayOrder: category?.displayOrder ?? statLookup.size + index
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(({ displayOrder, ...stat }) => stat);

  return {
    teamKey: String(team.team_key),
    name: stringValue(team.name),
    manager: stringValue(manager.nickname || manager.guid),
    stats: uniqueBy(stats, "id")
  };
}

function inferStatCategories(teams) {
  const stats = uniqueBy(
    teams.flatMap((team) => team.stats),
    "id"
  );
  return stats.map((stat, displayOrder) => ({
    id: stat.id,
    name: stat.name,
    abbreviation: stat.abbreviation,
    sortOrder: null,
    displayOrder
  }));
}

function rankFor(value, teams, category) {
  const current = numericValue(value);
  if (current === null) return null;
  const ascending = category.sortOrder === 0;
  const betterCount = teams.reduce((count, team) => {
    const other = numericValue(team.stats.find((stat) => stat.id === String(category.id))?.value);
    if (other === null || other === current) return count;
    const isBetter = ascending ? other < current : other > current;
    return count + (isBetter ? 1 : 0);
  }, 0);
  return betterCount + 1;
}

function compareCategoryValues(myValue, otherValue, category) {
  const mine = numericValue(myValue);
  const other = numericValue(otherValue);
  if (mine === null || other === null || !category) return "unavailable";
  if (mine === other) return "tie";
  const ascending = category.sortOrder === 0;
  return ascending ? (mine < other ? "win" : "loss") : mine > other ? "win" : "loss";
}

function categoryRecordForTeam(team, teams, category) {
  if (!team) return null;
  const record = { wins: 0, losses: 0, ties: 0 };
  let compared = false;
  for (const otherTeam of teams) {
    if (otherTeam.teamKey === team.teamKey) continue;
    const result = compareCategoryValues(
      team.stats.find((stat) => stat.id === String(category.id))?.value,
      otherTeam.stats.find((stat) => stat.id === String(category.id))?.value,
      category
    );
    if (result === "win") record.wins += 1;
    if (result === "loss") record.losses += 1;
    if (result === "tie") record.ties += 1;
    if (result !== "unavailable") compared = true;
  }
  return compared ? record : null;
}

function rankForCategoryRecord(record, teamRecords) {
  if (!record) return null;
  const strength = record.wins + record.ties / 2;
  const betterCount = teamRecords.reduce((count, item) => {
    if (!item.record) return count;
    const otherStrength = item.record.wins + item.record.ties / 2;
    return count + (otherStrength > strength ? 1 : 0);
  }, 0);
  return betterCount + 1;
}

function numericValue(value) {
  if (value === undefined || value === null || value === "" || value === "-") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resourceList(value, resourceKey) {
  return toArray(value).flatMap((item) => {
    if (!isPlainObject(item)) return [];
    return item[resourceKey] === undefined ? [item] : toArray(item[resourceKey]);
  });
}

function unwrap(value, resourceKey) {
  return isPlainObject(value) && value[resourceKey] !== undefined ? value[resourceKey] : value;
}

function collectPropertyValues(value, property, results = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyValues(item, property, results);
    return results;
  }
  if (!isPlainObject(value)) return results;
  if (value[property] !== undefined) results.push(value[property]);
  for (const child of Object.values(value)) collectPropertyValues(child, property, results);
  return results;
}

function findFirstProperty(value, property) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstProperty(item, property);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isPlainObject(value)) return undefined;
  if (value[property] !== undefined) return value[property];
  for (const child of Object.values(value)) {
    const found = findFirstProperty(child, property);
    if (found !== undefined) return found;
  }
  return undefined;
}

function mergeDisjointObjects(items) {
  if (!items.every(isPlainObject)) return null;
  const keys = items.flatMap(Object.keys);
  if (new Set(keys).size !== keys.length) return null;
  return Object.assign({}, ...items);
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function hasContent(value) {
  if (value === 0 || value === false) return true;
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNumberedKey(key) {
  return /^\d+$/.test(key);
}

function stringValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function numberValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function yahooBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}
