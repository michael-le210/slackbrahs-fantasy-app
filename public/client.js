import { getJson } from "./client/api.js";
import { escapeHtml, getElements, setStatus } from "./client/dom.js";
import { createAppState, filterRecentLeagues } from "./client/state.js";
import { renderLeagueAverages } from "./client/views/averages-view.js";
import { renderComparison } from "./client/views/comparison-view.js";
import { renderCategoryStrengths } from "./client/views/strengths-view.js";

const state = createAppState();
const els = getElements();
const setAppStatus = (message) => setStatus(els, message);
state.theme = localStorage.getItem("yfb-theme") === "light" ? "light" : "dark";
applyTheme(state.theme);

init();

async function init() {
  try {
    const session = await requestJson("/api/me");
    const showWorkspace = session.signedIn && !session.needsConfig;
    state.profile = session.profile;
    state.signedIn = session.signedIn;
    updateProfile(state.profile, state.signedIn);
    els.signInButton.classList.toggle("hidden", session.signedIn);
    els.signOutButton.classList.toggle("hidden", !session.signedIn);
    els.controls.classList.toggle("hidden", !showWorkspace);
    els.viewTabs.classList.toggle("hidden", !showWorkspace);

    if (session.needsConfig) {
      setAppStatus("Create .env from .env.example with Yahoo client credentials, then restart the app.");
      return;
    }

    if (!session.signedIn) {
      setAppStatus("Sign in with Yahoo to load your fantasy basketball leagues.");
      return;
    }

    await loadLeagues();
  } catch (error) {
    console.error(error);
  }
}

async function loadLeagues() {
  setAppStatus("Loading your Yahoo fantasy basketball league history...");
  els.retryLeaguesButton.classList.add("hidden");
  let data;
  try {
    data = await requestJson("/api/leagues");
  } catch (error) {
    els.retryLeaguesButton.classList.remove("hidden");
    throw error;
  }
  const allLeagues = data.leagues || [];
  state.leagues = filterRecentLeagues(allLeagues);

  if (!state.leagues.length) {
    setAppStatus(
      allLeagues.length
        ? "No head-to-head Yahoo fantasy basketball leagues were found in the five most recent seasons."
        : "No head-to-head Yahoo fantasy basketball leagues were returned. Check that the Yahoo developer app has Fantasy Sports Read permission."
    );
    return;
  }

  els.leagueSelect.disabled = false;
  els.weekInput.disabled = false;
  els.weekPickerButton.disabled = false;
  els.loadButton.disabled = false;
  els.leagueSelect.innerHTML = state.leagues
    .map((league) => {
      const label = `${league.name} (${league.season || "season unknown"})`;
      return `<option value="${escapeHtml(league.leagueKey)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  state.selectedLeague = els.leagueSelect.value;
  updateWeekInput(state.leagues[0]);
  setAppStatus("Choose a league and week, then load the weekly comparison.");
}

els.retryLeaguesButton.addEventListener("click", () => {
  loadLeagues().catch((error) => console.error(error));
});

els.profileButton.addEventListener("click", () => {
  setProfileOpen(els.profilePopover.classList.contains("hidden"));
});

document.addEventListener("click", (event) => {
  if (!els.profileMenu.contains(event.target)) setProfileOpen(false);
});

els.weekPickerButton.addEventListener("click", () => {
  setWeekPickerOpen(els.weekPickerMenu.classList.contains("hidden"));
});

els.weekPickerButton.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setWeekPickerOpen(true);
    focusSelectedWeek();
  }
});

els.weekPickerMenu.addEventListener("click", (event) => {
  const option = event.target.closest("[data-week-value]");
  if (!option) return;
  setSelectedWeek(option.dataset.weekValue);
  setWeekPickerOpen(false);
  els.weekPickerButton.focus();
});

els.weekPickerMenu.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const option = event.target.closest("[data-week-value]");
    if (option) {
      setSelectedWeek(option.dataset.weekValue);
      setWeekPickerOpen(false);
      els.weekPickerButton.focus();
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    setWeekPickerOpen(false);
    els.weekPickerButton.focus();
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const options = [...els.weekPickerMenu.querySelectorAll("[data-week-value]")];
  const currentIndex = options.indexOf(document.activeElement);
  const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
  options[nextIndex]?.focus();
});

document.addEventListener("click", (event) => {
  if (!els.weekPicker.contains(event.target)) setWeekPickerOpen(false);
});

els.themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  els.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  localStorage.setItem("yfb-theme", theme);
}

function updateProfile(profile, signedIn, teamManager = "") {
  const name = teamManager || profile?.givenName || profile?.name || profile?.nickname || (signedIn ? "Yahoo user" : "Not signed in");
  els.profileAvatar.textContent = signedIn ? initials(name) : "?";
  els.profileName.textContent = name;
}

function updateProfileFromTeam(manager) {
  if (manager && state.signedIn) updateProfile(state.profile, true, manager);
}

function initials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "Y";
}

function setProfileOpen(open) {
  els.profilePopover.classList.toggle("hidden", !open);
  els.profileButton.setAttribute("aria-expanded", String(open));
}

els.leagueSelect.addEventListener("change", () => {
  state.selectedLeague = els.leagueSelect.value;
  state.latestScoreboard = null;
  state.categoryStrengths = null;
  state.categoryStrengthsLeague = "";
  const league = state.leagues.find((item) => item.leagueKey === state.selectedLeague);
  updateWeekInput(league);
  setActiveView("comparison");
});

function updateWeekInput(league) {
  const startWeek = Math.max(1, Number(league?.startWeek) || 1);
  const endWeek = Math.max(startWeek, Number(league?.endWeek) || 30);
  const currentWeek = Number(league?.currentWeek);
  const options = Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index
  )
    .map((week) => `<option value="${week}">Week ${week}</option>`)
    .join("");
  const menuOptions = Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index
  )
    .map((week) => `<div class="week-option" role="option" tabindex="-1" data-week-value="${week}">Week ${week}</div>`)
    .join("");

  els.weekInput.innerHTML = `<option value="">Select week</option>${options}`;
  els.weekPickerMenu.innerHTML = menuOptions;
  setSelectedWeek(currentWeek >= startWeek && currentWeek <= endWeek ? String(currentWeek) : "");
  setWeekPickerOpen(false);
}

function setSelectedWeek(value) {
  els.weekInput.value = value;
  els.weekPickerValue.textContent = value ? `Week ${value}` : "Select week";
  els.weekPickerMenu.querySelectorAll("[data-week-value]").forEach((option) => {
    const selected = option.dataset.weekValue === value;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function setWeekPickerOpen(open) {
  els.weekPickerMenu.classList.toggle("hidden", !open);
  els.weekPickerButton.setAttribute("aria-expanded", String(open));
}

function focusSelectedWeek() {
  const selected = els.weekPickerMenu.querySelector("[aria-selected=\"true\"]");
  (selected || els.weekPickerMenu.querySelector("[data-week-value]"))?.focus();
}

els.loadButton.addEventListener("click", () => {
  loadWeeklyComparison().catch((error) => console.error(error));
});

async function loadWeeklyComparison() {
  if (!els.leagueSelect.value) return;
  const requestedLeague = els.leagueSelect.value;
  const params = new URLSearchParams({ leagueKey: requestedLeague });
  if (els.weekInput.value) params.set("week", els.weekInput.value);

  els.loadButton.disabled = true;
  setAppStatus("Loading weekly comparison...");
  els.scoreboard.innerHTML = "";
  try {
    const data = await requestJson(`/api/league-week?${params}`);
    state.latestScoreboard = data;
    if (state.activeView === "comparison" && state.selectedLeague === requestedLeague) {
      showScoreboard(data);
    }
  } finally {
    els.loadButton.disabled = false;
  }
}

els.showRanks.addEventListener("change", () => {
  state.showRanks = els.showRanks.checked;
  if (state.activeView === "strengths" && state.categoryStrengths) {
    showStrengths(state.categoryStrengths);
  } else if (state.activeView === "averages" && state.categoryStrengths?.averages) {
    showAverages(state.categoryStrengths.averages);
  } else if (state.latestScoreboard) {
    showScoreboard(state.latestScoreboard);
  }
});

els.comparisonTab.addEventListener("click", () => setActiveView("comparison", true));
els.strengthsTab.addEventListener("click", () => setActiveView("strengths"));
els.averagesTab.addEventListener("click", () => setActiveView("averages"));

function setActiveView(view, loadComparison = false) {
  state.activeView = view;
  const comparisonActive = view === "comparison";
  const strengthsActive = view === "strengths";
  const averagesActive = view === "averages";
  els.comparisonTab.classList.toggle("active", comparisonActive);
  els.strengthsTab.classList.toggle("active", strengthsActive);
  els.averagesTab.classList.toggle("active", averagesActive);
  els.comparisonTab.setAttribute("aria-selected", String(comparisonActive));
  els.strengthsTab.setAttribute("aria-selected", String(strengthsActive));
  els.averagesTab.setAttribute("aria-selected", String(averagesActive));

  if (comparisonActive) {
    if (state.latestScoreboard) showScoreboard(state.latestScoreboard);
    else if (loadComparison && state.selectedLeague) loadWeeklyComparison().catch((error) => console.error(error));
    else setAppStatus("Choose a league and week, then load the weekly comparison.");
    return;
  }

  if (!state.selectedLeague) {
    setAppStatus(`Sign in and choose a league to load ${averagesActive ? "league averages" : "category strengths"}.`);
    return;
  }
  if (state.categoryStrengths && state.categoryStrengthsLeague === state.selectedLeague) {
    if (strengthsActive) showStrengths(state.categoryStrengths);
    else if (averagesActive && state.categoryStrengths.averages) showAverages(state.categoryStrengths.averages);
    return;
  }
  loadCategoryStrengths();
}

function showScoreboard(data) {
  const rows = data.comparison?.rows || [];
  if (!rows.length) {
    setAppStatus("No category totals were found for that league/week. Check Fantasy Sports Read permission in Yahoo.");
    return;
  }

  const week = data.week || els.weekInput.value || "current";
  updateProfileFromTeam(rows.find((row) => row.isMine)?.manager);
  const opponentCount = data.comparison.myTeamKey ? rows.length - 1 : rows.length;
  setAppStatus(
    data.comparison.myTeamKey
      ? `Showing your team against ${opponentCount} league opponent${opponentCount === 1 ? "" : "s"} for week ${week}.`
      : `Showing ${rows.length} league teams for week ${week}. Your team could not be identified.`
  );
  els.scoreboard.innerHTML = renderComparison(data.comparison, { showRanks: state.showRanks });
}

async function loadCategoryStrengths() {
  const requestedLeague = state.selectedLeague;
  els.retryLeaguesButton.classList.add("hidden");
  els.scoreboard.innerHTML = "";
  setAppStatus("Loading category strengths for every week...");
  try {
    const params = new URLSearchParams({ leagueKey: requestedLeague });
    const data = await requestJson(`/api/league-strengths?${params}`);
    state.categoryStrengths = data;
    state.categoryStrengthsLeague = requestedLeague;
    if (!data.weeks?.length) {
      if ((state.activeView === "strengths" || state.activeView === "averages") && state.selectedLeague === requestedLeague) {
        setAppStatus(state.activeView === "averages" ? "No league averages were found for this league." : "No category strengths were found for this league.");
      }
      return;
    }
    if (state.activeView === "strengths" && state.selectedLeague === requestedLeague) {
      showStrengths(data);
    } else if (state.activeView === "averages" && state.selectedLeague === requestedLeague) {
      showAverages(data.averages);
    }
  } catch (error) {
    console.error(error);
  }
}

function showStrengths(data) {
  updateProfileFromTeam(data.myTeamManager);
  els.scoreboard.innerHTML = renderCategoryStrengths(data, { showRanks: state.showRanks });
  setAppStatus(`Showing your category strengths across ${data.weeks.length} week${data.weeks.length === 1 ? "" : "s"}.`);
}

function showAverages(data) {
  if (!data) {
    setAppStatus("No league averages were found for this league.");
    return;
  }
  updateProfileFromTeam(data.rows?.find((row) => row.isMine)?.manager);
  els.scoreboard.innerHTML = renderLeagueAverages(data);
  setAppStatus(`Comparing team averages with the league average across ${data.weeksCompared} week${data.weeksCompared === 1 ? "" : "s"}.`);
}

async function requestJson(url) {
  try {
    return await getJson(url);
  } catch (error) {
    setAppStatus(error.message);
    throw error;
  }
}
