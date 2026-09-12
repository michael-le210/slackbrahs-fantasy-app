import { escapeHtml, ordinal } from "../dom.js";

const HIDDEN_CATEGORIES = new Set(["FGM", "FGA", "FTM", "FTA"]);

export function renderCategoryStrengths(strengths, { showRanks = true } = {}) {
  const categories = strengths.categories.filter(isStrengthCategoryVisible);
  const headers = categories
    .map((category) => `<th scope="col">${escapeHtml(category.abbreviation || category.name)}</th>`)
    .join("");
  const seasonCells = categories
    .map((category) => {
      const record = strengths.seasonRecord.find((item) => item.id === category.id);
      return renderStrengthCell(record, false, "season-strength");
    })
    .join("");
  const weekRows = strengths.weeks
    .map((week) => renderWeekRow(week, categories, showRanks))
    .join("");

  return `
    <section class="strength-card">
      <div class="strength-header">
        <div>
          <h2>Category strengths</h2>
          <p>Each record compares your team against every other team in the league for that week.</p>
        </div>
        <span class="comparison-count">${strengths.weeks.length} weeks</span>
      </div>
      <div class="strength-scroll">
        <table class="strength-table">
          <thead>
            <tr>
              <th class="week-column" scope="col">Week</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            <tr class="season-record-row">
              <th class="week-cell" scope="row">Season record</th>
              ${seasonCells}
            </tr>
            ${weekRows}
          </tbody>
        </table>
      </div>
      <p class="strength-note">Green means more category wins than losses. Red means more losses. The superscript is your league rank for that category that week.</p>
    </section>
  `;
}

function renderWeekRow(week, categories, showRanks) {
  const cells = categories
    .map((category) => {
      const record = week.records.find((item) => item.id === category.id);
      return renderStrengthCell(record, showRanks);
    })
    .join("");
  return `
    <tr>
      <th class="week-cell" scope="row">Week ${escapeHtml(week.week)}</th>
      ${cells}
    </tr>
  `;
}

function isStrengthCategoryVisible(category) {
  const labels = [category.abbreviation, category.name]
    .filter(Boolean)
    .map((label) => String(label).toUpperCase().replaceAll(" ", ""));
  return !labels.some((label) => [...HIDDEN_CATEGORIES].some((stat) => label === stat || label.includes(stat)));
}

function renderStrengthCell(record, showRank, extraClass = "") {
  if (!record || record.wins === null || record.wins === undefined) {
    return `<td class="strength-value unavailable ${extraClass}">—</td>`;
  }
  const recordText = `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;
  const rank = showRank && record.rank ? `<sup>${ordinal(record.rank)}</sup>` : "";
  const resultClass = record.wins > record.losses ? "strength-win" : record.wins < record.losses ? "strength-loss" : "strength-tie";
  return `<td class="strength-value ${resultClass} ${extraClass}">${recordText}${rank}</td>`;
}
