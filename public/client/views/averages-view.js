import { escapeHtml } from "../dom.js";

const HIDDEN_CATEGORIES = new Set(["FGM", "FGA", "FTM", "FTA"]);

export function renderLeagueAverages(averages) {
  const categories = averages.categories.filter(isVisibleCategory);
  const headers = categories
    .map((category) => `<th scope="col">${escapeHtml(category.abbreviation || category.name)}</th>`)
    .join("");
  const leagueCells = categories
    .map((category) => {
      const stat = averages.leagueAverage.find((item) => item.id === String(category.id));
      return `<td class="average-value league-average-value">${formatAverage(stat?.value, category)}</td>`;
    })
    .join("");
  const teamRows = averages.rows
    .map((row) => renderTeamRow(row, categories, averages.leagueAverage))
    .join("");

  return `
    <section class="average-card">
      <div class="average-header">
        <div>
          <h2>League average comparison</h2>
          <p>Average category totals for every team compared with the league average.</p>
        </div>
        <span class="comparison-count">${averages.weeksCompared} weeks</span>
      </div>
      <div class="average-scroll">
        <table class="average-table">
          <thead>
            <tr>
              <th class="team-column" scope="col">Team</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            <tr class="league-average-row">
              <th class="team-cell" scope="row">League average</th>
              ${leagueCells}
            </tr>
            ${teamRows}
          </tbody>
        </table>
      </div>
      <p class="average-note">Green means the team average is better than the league average for that category. Red means it is worse.</p>
    </section>
  `;
}

function renderTeamRow(row, categories, leagueAverage) {
  const cells = categories
    .map((category) => {
      const stat = row.stats.find((item) => item.id === String(category.id));
      const leagueStat = leagueAverage.find((item) => item.id === String(category.id));
      const displayValue = formatAverage(stat?.value, category);
      const leagueDisplayValue = formatAverage(leagueStat?.value, category);
      const result = displayValue === leagueDisplayValue
        ? "tie"
        : stat?.result || compareResult(stat?.value, leagueStat?.value, category);
      return `<td class="average-value ${result}">${displayValue}</td>`;
    })
    .join("");

  return `
    <tr class="${row.isMine ? "my-team-row" : ""}">
      <th class="team-cell" scope="row">
        <span class="team-name">${escapeHtml(row.name)}</span>
        ${row.manager ? `<span class="team-manager">${escapeHtml(row.manager)}</span>` : ""}
        ${row.isMine ? `<span class="team-badge">Your team</span>` : ""}
      </th>
      ${cells}
    </tr>
  `;
}

function isVisibleCategory(category) {
  const labels = [category.abbreviation, category.name]
    .filter(Boolean)
    .map((label) => String(label).toUpperCase().replaceAll(" ", ""));
  return !labels.some((label) => [...HIDDEN_CATEGORIES].some((stat) => label === stat || label.includes(stat)));
}

function formatAverage(value, category) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const numericValue = Number(value);
  const label = `${category.abbreviation || ""} ${category.name || ""}`;
  if (label.includes("%")) return numericValue.toFixed(3).replace(/^0/, "");
  return String(Math.round(numericValue));
}

function compareResult(value, otherValue, category) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(otherValue))) return "unavailable";
  if (Number(value) === Number(otherValue)) return "tie";
  const ascending = category.sortOrder === 0;
  return ascending
    ? Number(value) < Number(otherValue) ? "win" : "loss"
    : Number(value) > Number(otherValue) ? "win" : "loss";
}
