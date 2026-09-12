export function getElements() {
  return {
    signInButton: document.querySelector("#signInButton"),
    signOutButton: document.querySelector("#signOutButton"),
    profileMenu: document.querySelector("#profileMenu"),
    profileButton: document.querySelector("#profileButton"),
    profilePopover: document.querySelector("#profilePopover"),
    profileAvatar: document.querySelector("#profileAvatar"),
    profileName: document.querySelector("#profileName"),
    themeToggle: document.querySelector("#themeToggle"),
    controls: document.querySelector("#controls"),
    viewTabs: document.querySelector("#viewTabs"),
    leagueSelect: document.querySelector("#leagueSelect"),
    weekInput: document.querySelector("#weekInput"),
    weekPicker: document.querySelector("#weekPicker"),
    weekPickerButton: document.querySelector("#weekPickerButton"),
    weekPickerValue: document.querySelector("#weekPickerValue"),
    weekPickerMenu: document.querySelector("#weekPickerMenu"),
    loadButton: document.querySelector("#loadButton"),
    showRanks: document.querySelector("#showRanks"),
    comparisonTab: document.querySelector("#comparisonTab"),
    strengthsTab: document.querySelector("#strengthsTab"),
    averagesTab: document.querySelector("#averagesTab"),
    retryLeaguesButton: document.querySelector("#retryLeaguesButton"),
    status: document.querySelector("#status"),
    scoreboard: document.querySelector("#scoreboard")
  };
}

export function setStatus(elements, message) {
  elements.status.textContent = message;
}

export function ordinal(value) {
  const remainder = value % 100;
  const suffix = remainder >= 11 && remainder <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th");
  return `${value}${suffix}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
