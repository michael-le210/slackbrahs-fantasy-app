import { escapeHtml, ordinal } from "../dom.js";

export function renderComparison(comparison, { showRanks = true } = {}) {
  const categoryHeaders = comparison.categories
    .map((category) => `<th scope="col">${escapeHtml(category.abbreviation || category.name)}</th>`)
    .join("");

  return `
    <section class="comparison-card">
      <div class="comparison-header">
        <div>
          <h2>Team ranks per category</h2>
          <p>Green cells are category wins for your team. Red cells are losses.</p>
        </div>
        <span class="comparison-count">${comparison.rows.length} teams</span>
      </div>
      <div class="comparison-scroll">
        <table class="comparison-table">
          <thead>
            <tr>
              <th class="team-column" scope="col">Team</th>
              ${categoryHeaders}
              <th class="score-column" scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.rows.map((row) => renderComparisonRow(row, comparison.categories, showRanks)).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderComparisonRow(row, categories, showRanks) {
  const statCells = categories
    .map((category) => {
      const stat = row.stats.find((item) => item.id === category.id);
      const rank = showRanks && stat?.rank ? `<sup>${ordinal(stat.rank)}</sup>` : "";
      return `<td class="comparison-value ${stat?.result || "neutral"}">${escapeHtml(stat?.value ?? "-")}${rank}</td>`;
    })
    .join("");
  const score = row.isMine
    ? `<span class="your-team-score">Your team</span>`
    : row.comparison
      ? `<strong>${row.comparison.wins} – ${row.comparison.losses}</strong>${row.comparison.ties ? ` <span class="ties">(${row.comparison.ties} tied)</span>` : ""}`
      : "—";

  return `
    <tr class="${row.isMine ? "my-team-row" : ""}">
      <th class="team-cell" scope="row">
        <span class="team-name">${escapeHtml(row.name)}</span>
        ${row.manager ? `<span class="team-manager">${escapeHtml(row.manager)}</span>` : ""}
        ${row.isMine ? `<span class="team-badge">Your team</span>` : ""}
      </th>
      ${statCells}
      <td class="score-cell">${score}</td>
    </tr>
  `;
}
