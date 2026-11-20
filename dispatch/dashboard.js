const FOLDERS = [
  { id: "agency", name: "Agency Detags", short: "Agency", received: 230, outstanding: 50 },
  { id: "detags", name: "Detags", short: "Detags", received: 470, outstanding: 180 },
  { id: "transfers", name: "Transfers", short: "Transfers", received: 300, outstanding: 94 },
  { id: "unadopts", name: "Unadopts", short: "Unadopts", received: 194, outstanding: 58 }
];

const BRANDS = [
  { id: "vw", name: "Volkswagen", count: 362, color: "#3c78bf" },
  { id: "audi", name: "Audi", count: 286, color: "#8b5bb6" },
  { id: "skoda", name: "Škoda", count: 196, color: "#159b83" },
  { id: "seat", name: "SEAT", count: 118, color: "#d39a43" },
  { id: "cupra", name: "CUPRA", count: 101, color: "#53657f" },
  { id: "vwcv", name: "Volkswagen Commercial Vehicles", count: 91, color: "#4b9aae" },
  { id: "other", name: "Other / unclassified", count: 40, color: "#b6bdc8" }
];

const FOLDER_BRAND_MIX = {
  agency: [34, 24, 17, 9, 8, 6, 2],
  detags: [25, 24, 19, 10, 9, 9, 4],
  transfers: [28, 23, 18, 11, 9, 7, 4],
  unadopts: [30, 22, 19, 10, 8, 7, 4]
};

const AGENT_NAMES = [
  "Agent 01", "Agent 02", "Agent 03", "Agent 04", "Agent 05", "Agent 06", "Agent 07",
  "Agent 08", "Agent 09", "Agent 10", "Agent 11", "Agent 12", "Agent 13", "Agent 14"
];

const ASSIGNMENT_MATRIX = [
  [12,30,18,10],[11,28,17,9],[10,32,20,9],[9,26,16,8],[10,29,18,9],[12,31,19,10],[10,27,16,8],
  [9,25,15,7],[11,30,18,9],[10,28,17,8],[9,26,16,7],[10,27,17,8],[8,24,15,7],[9,27,18,9]
];

const PERIODS = {
  today: { label: "Today", factor: 0.055 },
  week: { label: "Last 7 days", factor: 0.235 },
  month: { label: "Last 30 days", factor: 1 },
  quarter: { label: "Last 90 days", factor: 2.72 }
};

const state = { view: "overview", period: "month", folder: "all", memberSearch: "" };
const pageContent = document.getElementById("pageContent");
const toast = document.getElementById("toast");

function number(value) {
  return Math.round(value).toLocaleString("en-GB");
}
function scaled(value) {
  return Math.max(0, Math.round(value * PERIODS[state.period].factor));
}
function selectedFolderName() {
  if (state.folder === "all") return "All inboxes";
  const item = FOLDERS.find(folder => folder.id === state.folder);
  return item ? item.name : "All inboxes";
}
function folderAssignedTotals() {
  return FOLDERS.map((folder, index) => ({
    ...folder,
    assigned: scaled(ASSIGNMENT_MATRIX.reduce((sum, row) => sum + row[index], 0))
  }));
}
function allocateByWeights(total, weights) {
  const denominator = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const values = weights.map(weight => Math.floor(total * weight / denominator));
  let remaining = total - values.reduce((sum, value) => sum + value, 0);
  const order = weights.map((weight, index) => ({ index, remainder: total * weight / denominator - values[index] })).sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining; i++) values[order[i % order.length].index] += 1;
  return values;
}
function brandRows() {
  const targetTotal = state.folder === "all" ? scaled(1194) : scaled(FOLDERS.find(folder => folder.id === state.folder).received);
  const weights = state.folder === "all" ? BRANDS.map(brand => brand.count) : FOLDER_BRAND_MIX[state.folder];
  const values = allocateByWeights(targetTotal, weights);
  return BRANDS.map((brand, index) => ({ ...brand, value: values[index] }));
}
function matrixRows() {
  return AGENT_NAMES.map((name, index) => {
    const cells = ASSIGNMENT_MATRIX[index].map(value => scaled(value));
    const total = cells.reduce((sum, value) => sum + value, 0);
    const selectedIndex = FOLDERS.findIndex(folder => folder.id === state.folder);
    return { name, cells, total, visibleTotal: state.folder === "all" ? total : cells[selectedIndex] };
  });
}
function totals() {
  const received = state.folder === "all" ? scaled(1194) : scaled(FOLDERS.find(folder => folder.id === state.folder).received);
  const assigned = folderAssignedTotals().filter(folder => state.folder === "all" || folder.id === state.folder).reduce((sum, folder) => sum + folder.assigned, 0);
  const resolved = state.folder === "all" ? scaled(812) : Math.round(received * 0.68);
  const outstanding = state.folder === "all" ? scaled(382) : scaled(FOLDERS.find(folder => folder.id === state.folder).outstanding);
  return { received, assigned, resolved, outstanding };
}
function pageHeading(eyebrow, title, copy) {
  return '<div class="page-heading"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1><p class="heading-copy">' + copy + '</p></div><div class="heading-meta"><span>Reporting period</span><span class="period-pill">' + PERIODS[state.period].label + '</span></div></div>';
}
function kpiCard(label, value, note, symbol, tone) {
  return '<article class="kpi-card"><div class="kpi-top"><span>' + label + '</span><span class="kpi-icon">' + symbol + '</span></div><div class="kpi-value">' + value + '</div><div class="kpi-foot">' + note + '</div></article>';
}
function brandBars(rows, compact) {
  const max = Math.max(...rows.map(row => row.value), 1);
  return '<div class="brand-list">' + rows.map(row => {
    const share = rows.reduce((sum, item) => sum + item.value, 0) ? row.value / rows.reduce((sum, item) => sum + item.value, 0) * 100 : 0;
    return '<div class="brand-row"><div class="brand-name"><span class="legend-dot" style="background:' + row.color + '"></span>' + row.name + '</div><div class="bar-track"><div class="bar-fill" style="width:' + (row.value / max * 100) + '%;background:' + row.color + '"></div></div><div class="brand-count">' + number(row.value) + '<span class="brand-share">' + share.toFixed(1) + '%</span></div></div>';
  }).join("") + '</div>';
}
function folderRows() {
  const rows = folderAssignedTotals().filter(folder => state.folder === "all" || folder.id === state.folder);
  const visibleAssigned = rows.reduce((sum, row) => sum + row.assigned, 0);
  return '<div class="folder-list">' +
    '<div class="folder-row"><div></div><div class="folder-metric">RECEIVED</div><div class="folder-metric">ASSIGNED</div><div class="folder-metric">OPEN</div></div>' +
    rows.map(folder => '<div class="folder-row"><div class="folder-name">' + folder.name + '<span class="folder-sub">' + (folder.assigned ? (folder.assigned / Math.max(1, visibleAssigned) * 100).toFixed(1) : "0.0") + '% of visible allocations</span></div><div class="folder-metric">' + number(scaled(folder.received)) + '</div><div class="folder-metric">' + number(folder.assigned) + '</div><div class="folder-metric">' + number(scaled(folder.outstanding)) + '</div></div>').join("") +
    '</div>';
}
function memberCell(name) {
  const initials = name.replace("Agent ", "A");
  return '<div class="member-cell"><span class="member-avatar">' + initials + '</span><span><span class="member-name">' + name + '</span><span class="member-role">Team member</span></span></div>';
}
function shareTable(rows, full) {
  const selectedFolders = state.folder === "all" ? FOLDERS : FOLDERS.filter(folder => folder.id === state.folder);
  const allRows = matrixRows();
  const totalsByFolder = selectedFolders.map(folder => {
    const index = FOLDERS.findIndex(item => item.id === folder.id);
    return allRows.reduce((sum, row) => sum + row.cells[index], 0);
  });
  const totalVisibleAssignments = allRows.reduce((sum, row) => sum + selectedFolders.reduce((part, folder) => part + row.cells[FOLDERS.findIndex(item => item.id === folder.id)], 0), 0);
  const shown = rows.filter(row => row.name.toLowerCase().includes(state.memberSearch.toLowerCase()));
  if (!shown.length) return '<div class="empty-state">No team members match your search.</div>';
  const head = '<thead><tr><th>Team member</th>' + selectedFolders.map(folder => '<th>' + folder.short + ' · share</th>').join("") + (full ? '<th>Total allocated</th><th>Overall share</th>' : '<th>Total</th>') + '</tr></thead>';
  const body = '<tbody>' + shown.map(row => {
    const cells = selectedFolders.map((folder, folderPosition) => {
      const index = FOLDERS.findIndex(item => item.id === folder.id);
      const value = row.cells[index];
      const share = totalsByFolder[folderPosition] ? value / totalsByFolder[folderPosition] * 100 : 0;
      return '<td class="share-cell"><div class="share-line"><span>' + number(value) + '</span><span class="share-mini-track"><span class="share-mini-fill" style="display:block;width:' + share + '%"></span></span><span class="share-percent">' + share.toFixed(1) + '%</span></div></td>';
    }).join("");
    const visibleTotal = selectedFolders.reduce((sum, folder) => sum + row.cells[FOLDERS.findIndex(item => item.id === folder.id)], 0);
    const overallShare = visibleTotal / Math.max(1, totalVisibleAssignments) * 100;
    return '<tr><td>' + memberCell(row.name) + '</td>' + cells + '<td class="total-cell">' + number(visibleTotal) + '</td>' + (full ? '<td class="total-cell">' + overallShare.toFixed(1) + '%</td>' : '') + '</tr>';
  }).join("") + '</tbody>';
  return '<div class="table-wrap"><table class="data-table">' + head + body + '</table></div>';
}
function summaryTiles() {
  const t = totals();
  const assignedShare = t.received ? (t.assigned / t.received * 100) : 0;
  return '<div class="share-summary">' +
    '<div class="summary-tile"><span>Assigned tickets</span><strong>' + number(t.assigned) + '</strong></div>' +
    '<div class="summary-tile"><span>Assignment coverage</span><strong>' + assignedShare.toFixed(1) + '%</strong></div>' +
    '<div class="summary-tile"><span>Open workload</span><strong>' + number(t.outstanding) + '</strong></div>' +
    '<div class="summary-tile"><span>Team members</span><strong>14</strong></div>' +
    '</div>';
}

function renderOverview() {
  const t = totals();
  const brands = brandRows();
  const totalBrands = brands.reduce((sum, row) => sum + row.value, 0);
  const unclassified = brands.find(row => row.id === "other").value;
  const assignedRate = t.received ? (t.assigned / t.received * 100) : 0;
  pageContent.innerHTML = pageHeading("MANAGEMENT OVERVIEW", "Good morning. Here’s your operation.", "A consolidated view of ticket volume, brand mix and how work is distributed across the four inboxes.") +
    '<div class="kpi-grid">' +
      kpiCard("Tickets received", number(t.received), "Across the selected scope", "↓") +
      kpiCard("Tickets assigned", number(t.assigned), assignedRate.toFixed(1) + "% of received volume", "↗") +
      kpiCard("Tickets resolved", number(t.resolved), "Recorded completions in sample data", "✓") +
      kpiCard("Outstanding workload", number(t.outstanding), "Open tickets at the reporting snapshot", "◷") +
    '</div>' +
    '<div class="grid-two">' +
      '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Tickets by brand</h2><p class="panel-subtitle">Volume and share of received tickets</p></div><button class="panel-action" type="button" data-go="brands">View details ↗</button></div>' +
        brandBars(brands.slice().sort((a,b) => b.value-a.value), true) +
        '<div class="unclassified-note"><strong>' + number(unclassified) + ' tickets</strong> (' + (totalBrands ? (unclassified/totalBrands*100).toFixed(1) : "0.0") + '%) are currently grouped as Other / unclassified in this sample. In the live system, uncertain brand matches should be reviewed rather than guessed.</div>' +
      '</section>' +
      '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Inbox distribution</h2><p class="panel-subtitle">Received, allocated and currently open</p></div><button class="panel-action" type="button" data-go="folders">View folder share ↗</button></div>' +
        folderRows() +
      '</section>' +
    '</div>' +
    '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Member share by folder</h2><p class="panel-subtitle">Each member’s share of assigned tickets within the selected inbox</p></div><button class="panel-action" type="button" data-go="folders">Open full matrix ↗</button></div>' +
      shareTable(matrixRows().sort((a,b) => b.visibleTotal-a.visibleTotal).slice(0,6), false) +
    '</section>';
}
function renderBrands() {
  const rows = brandRows();
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const known = total - (rows.find(row => row.id === "other")?.value || 0);
  const unclassified = rows.find(row => row.id === "other")?.value || 0;
  pageContent.innerHTML = pageHeading("BRAND INTELLIGENCE", "Which brands are driving the workload?", "Understand how many tickets relate to each brand, and how the mix changes by inbox and reporting period.") +
    '<div class="kpi-grid">' +
      kpiCard("Total tickets in scope", number(total), selectedFolderName(), "▤") +
      kpiCard("Identified brands", number(known), total ? (known/total*100).toFixed(1) + "% of volume" : "0% of volume", "◉") +
      kpiCard("Audi tickets", number(rows.find(row => row.id === "audi").value), "Audi share " + (total ? (rows.find(row => row.id === "audi").value/total*100).toFixed(1) : "0") + "%", "A") +
      kpiCard("Škoda tickets", number(rows.find(row => row.id === "skoda").value), "Škoda share " + (total ? (rows.find(row => row.id === "skoda").value/total*100).toFixed(1) : "0") + "%", "Š") +
    '</div>' +
    '<div class="grid-two">' +
      '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Brand volume</h2><p class="panel-subtitle">Sorted by ticket count · descending</p></div></div>' +
        brandBars(rows.slice().sort((a,b) => b.value-a.value), false) +
      '</section>' +
      '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Brand mix at a glance</h2><p class="panel-subtitle">Share of tickets within the current scope</p></div></div>' +
        '<div class="brand-detail-grid">' + rows.map(row => '<article class="brand-detail-card"><div class="brand-detail-top"><span class="legend-dot" style="background:' + row.color + '"></span><span class="brand-detail-name">' + row.name + '</span></div><div class="brand-detail-count">' + number(row.value) + '</div><div class="brand-detail-note">' + (total ? (row.value/total*100).toFixed(1) : "0.0") + '% of ticket volume</div></article>').join("") + '</div>' +
        '<div class="unclassified-note"><strong>Brand identification rule:</strong> the live dashboard should prefer an explicit brand field or a validated ticket reference. Ambiguous subjects should remain unclassified until confirmed.</div>' +
      '</section>' +
    '</div>' +
    '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Brand coverage</h2><p class="panel-subtitle">All supported brand categories are retained, including Other / unclassified</p></div></div>' +
      '<div class="info-strip"><span>ⓘ</span><span>This preview uses illustrative brand totals. Once connected, this view will count unique tickets by brand and allow drill-down by inbox, period and ticket reference.</span></div>' +
      brandBars(rows, false) +
    '</section>';
}
function renderFolders() {
  const rows = matrixRows();
  const folderTotals = folderAssignedTotals();
  const totalAssigned = rows.reduce((sum, row) => sum + row.total, 0);
  pageContent.innerHTML = pageHeading("WORKLOAD DISTRIBUTION", "Every member. Every folder.", "See each member’s allocation volume and percentage share within each inbox. Open workload is shown separately from historical assignments.") +
    summaryTiles() +
    '<div class="info-strip"><span>ⓘ</span><span><strong>How to read this:</strong> each folder cell shows the member’s assigned-ticket count and their percentage of all assignments in that folder. The Total column is their combined allocation volume across the visible folders. These are sample figures, not actual team performance.</span></div>' +
    '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Member allocation matrix</h2><p class="panel-subtitle">' + number(totalAssigned) + ' sample assignment records · ' + selectedFolderName() + '</p></div><div class="section-toolbar"><input class="search-control" id="memberSearch" type="search" placeholder="Search team members…" aria-label="Search team members" value="' + state.memberSearch.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"></div></div>' +
      shareTable(rows, true) +
    '</section>' +
    '<div class="grid-equal" style="margin-top:15px">' +
      '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Folder allocation totals</h2><p class="panel-subtitle">How assignment volume is split between inboxes</p></div></div>' +
        folderTotals.map(folder => '<div class="brand-row" style="grid-template-columns:116px minmax(80px,1fr) 48px;margin:13px 0"><div class="brand-name">' + folder.name + '</div><div class="bar-track"><div class="bar-fill" style="width:' + (folder.assigned/Math.max(1,totalAssigned)*100) + '%;background:#4d86c8"></div></div><div class="brand-count">' + number(folder.assigned) + '</div></div>').join("") +
      '</section>' +
      '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Outstanding work by folder</h2><p class="panel-subtitle">Current open tickets are a separate measure from allocated volume</p></div></div>' +
        FOLDERS.filter(folder => state.folder === "all" || folder.id === state.folder).map(folder => '<div class="folder-row" style="grid-template-columns:1fr 72px"><div class="folder-name">' + folder.name + '<span class="folder-sub">Open tickets in sample data</span></div><div class="folder-metric">' + number(scaled(folder.outstanding)) + '</div></div>').join("") +
      '</section>' +
    '</div>';
  const search = document.getElementById("memberSearch");
  if (search) search.addEventListener("input", event => {
    state.memberSearch = event.target.value;
    const caret = event.target.selectionStart;
    renderFolders();
    const next = document.getElementById("memberSearch");
    next.focus();
    next.setSelectionRange(caret, caret);
  });
}
function renderTeam() {
  const rows = matrixRows();
  const scopedTotal = rows.reduce((sum, row) => sum + row.visibleTotal, 0);
  const filtered = rows.filter(row => state.folder === "all" || FOLDERS.some((folder, index) => folder.id === state.folder && row.cells[index] > 0));
  pageContent.innerHTML = pageHeading("TEAM PERFORMANCE", "Understand the workload behind the numbers.", "This preview focuses on allocation distribution. Response and resolution performance will be added when the event history can measure them reliably.") +
    '<div class="kpi-grid">' +
      kpiCard("Team members", String(filtered.length), "Illustrative roster size", "♧") +
      kpiCard("Allocated tickets", number(scopedTotal), selectedFolderName(), "↗") +
      kpiCard("Average per member", number(scopedTotal/Math.max(1,filtered.length)), "Within the current filter", "◷") +
      kpiCard("Folders in scope", state.folder === "all" ? "4" : "1", selectedFolderName(), "▤") +
    '</div>' +
    '<section class="panel"><div class="panel-heading"><div><h2 class="panel-title">Member allocation profiles</h2><p class="panel-subtitle">Sample allocation totals and folder mix</p></div></div>' +
      '<div class="agent-grid">' + filtered.map(row => '<article class="agent-card"><div class="agent-card-head"><span class="member-avatar">' + row.name.replace("Agent ","A") + '</span><span class="member-name">' + row.name + '</span></div><div class="agent-card-total">' + number(row.visibleTotal) + '</div><div class="agent-card-caption">Assigned tickets · current filter</div><div class="agent-folder-tags">' + FOLDERS.filter(folder => state.folder === "all" || folder.id === state.folder).map(folder => '<span>' + folder.short + ': ' + number(row.cells[FOLDERS.findIndex(item => item.id === folder.id)]) + '</span>').join("") + '</div></article>').join("") + '</div>' +
    '</section>' +
    '<div class="info-strip" style="margin-top:15px"><span>ⓘ</span><span>Once the live event history is available, each profile can include resolution time, active handling time, first response, handovers, flags, reopened tickets and workload adjusted by scheduled working hours. Member visibility will be enforced by account permissions, not by hiding elements in the browser.</span></div>';
}
function renderOperations() {
  pageContent.innerHTML = pageHeading("OPERATIONS MANAGEMENT", "The control centre is being prepared.", "The interface will eventually manage dispatching, rosters, eligibility, inbox rules and system health.") +
    '<div class="info-strip"><span>ⓘ</span><span><strong>Prototype safety:</strong> none of the controls below are connected to Outlook, the tracker or the dispatch engine. No operational action can be executed from this preview.</span></div>' +
    '<div class="control-grid">' +
      '<article class="control-card"><h3>Global dispatch control</h3><p>Pause, resume and emergency-stop dispatching with verification and audit history.</p><span class="control-tag">PLANNED · NOT CONNECTED</span></article>' +
      '<article class="control-card"><h3>Roster and shift management</h3><p>Manage early and late schedules, special coverage windows and roster versions.</p><span class="control-tag">PLANNED · NOT CONNECTED</span></article>' +
      '<article class="control-card"><h3>Agent eligibility</h3><p>Control which agents can receive tickets in each inbox, with a before-and-after preview.</p><span class="control-tag">PLANNED · NOT CONNECTED</span></article>' +
      '<article class="control-card"><h3>Dispatch rules</h3><p>Configure global fairness, workload weighting, assignment priorities and recovery logic.</p><span class="control-tag">PLANNED · NOT CONNECTED</span></article>' +
      '<article class="control-card"><h3>Inbox management</h3><p>Monitor the four inboxes, change permitted settings and review routing exceptions.</p><span class="control-tag">PLANNED · NOT CONNECTED</span></article>' +
      '<article class="control-card"><h3>Reliability centre</h3><p>Review tracker writes, assignment failures, duplicate events, recoveries and sync health.</p><span class="control-tag">PLANNED · NOT CONNECTED</span></article>' +
    '</div>';
}
function render() {
  document.getElementById("topbarPage").textContent = ({
    overview: "Overview", brands: "Brand insights", folders: "Folder share",
    team: "Team performance", operations: "Operations control"
  })[state.view];
  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  if (state.view === "overview") renderOverview();
  if (state.view === "brands") renderBrands();
  if (state.view === "folders") renderFolders();
  if (state.view === "team") renderTeam();
  if (state.view === "operations") renderOperations();
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.memberSearch = "";
    render();
    if (window.innerWidth < 820) pageContent.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
document.getElementById("periodSelect").addEventListener("change", event => {
  state.period = event.target.value;
  render();
});
document.getElementById("folderSelect").addEventListener("change", event => {
  state.folder = event.target.value;
  render();
});
document.addEventListener("click", event => {
  const trigger = event.target.closest("[data-go]");
  if (trigger) {
    state.view = trigger.dataset.go;
    state.memberSearch = "";
    render();
  }
});
render();
