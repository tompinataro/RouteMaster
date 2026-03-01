#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { readCsv, writeCsv } from "./csv-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.join(__dirname, "projects.csv");
const ENV_PATH = path.join(__dirname, ".env");
const OUTPUT_PATH = path.join(__dirname, "tracker-view.csv");
const OUTPUT_HTML_PATH = path.join(__dirname, "tracker-view.html");
const CANOPI_DIR = "/Users/tompinataro/My Projects/Canopi";
const CANOPI_PROJECTS_PATH = path.join(CANOPI_DIR, "projects.csv");
const CANOPI_HTML_PATH = path.join(CANOPI_DIR, "tracker-view.html");

dotenv.config({ path: ENV_PATH, override: false });

const EXECUTABLE_STATUS_COLUMNS = [
  "build_ios_ipa_status",
  "build_android_aab_status",
  "test_ios_device_status",
  "test_android_device_status",
  "asc_submission_status",
  "gplay_submission_status",
  "ci_pipeline_status",
  "release_ready_status",
];

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function hasEvidence(value) {
  const raw = clean(value);
  if (!raw) return false;
  if (/^(todo|tbd|n\/a|na|none|pending)$/i.test(raw)) return false;
  return true;
}

function hasRepoArtifact(row, key) {
  const raw = clean(row?.[key]);
  const repo = clean(row?.repo_path);
  if (!raw) return false;
  if (!repo) return false;
  if (/REPLACE_WITH_REAL_PATH/i.test(raw)) return false;
  try {
    if (!fs.existsSync(raw)) return false;
    const relative = path.relative(repo, raw);
    if (!relative) return true;
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function progressPercent(row) {
  const done = EXECUTABLE_STATUS_COLUMNS.filter((key) => normalize(row[key]) === "DONE").length;
  return `${Math.round((done / EXECUTABLE_STATUS_COLUMNS.length) * 100)}%`;
}

function deriveNotes(row) {
  const blocked = EXECUTABLE_STATUS_COLUMNS.find((key) => normalize(row[key]) === "BLOCKED");
  if (blocked) {
    return `Blocked: ${blocked}`;
  }

  const needsIosTest = normalize(row.test_ios_device_status) !== "DONE";
  const needsAndroidTest = normalize(row.test_android_device_status) !== "DONE";
  if (needsIosTest && needsAndroidTest) return "Awaiting iOS + Android device tests";
  if (needsIosTest) return "Awaiting iOS device test";
  if (needsAndroidTest) return "Awaiting Android device test";

  const auditNotes = clean(row.audit_repo_hygiene_notes);
  if (auditNotes) return auditNotes.slice(0, 120);
  return "";
}

function extractReason(text) {
  const raw = clean(text);
  if (!raw) return "";
  const reasonMatch = raw.match(/(?:^|[; ])reason=([^;]+)/i);
  const detailMatch = raw.match(/(?:^|[; ])detail=([^;]+)/i);
  const blockedMatch = raw.match(/(?:^|[; ])blocked=([^;]+)/i);
  return [blockedMatch?.[1], reasonMatch?.[1], detailMatch?.[1]]
    .map((value) => clean(value))
    .filter(Boolean)
    .join(" - ");
}

function firstPendingLifecycle(row) {
  return EXECUTABLE_STATUS_COLUMNS.find((key) => normalize(row[key]) !== "DONE") ?? "";
}

function labelForStatusColumn(key) {
  const labels = {
    build_ios_ipa_status: "Build iOS IPA",
    build_android_aab_status: "Build Android AAB",
    test_ios_device_status: "Run iOS device test",
    test_android_device_status: "Run Android device test",
    asc_submission_status: "Submit to App Store Connect",
    gplay_submission_status: "Submit to Google Play",
    ci_pipeline_status: "Verify CI pipeline",
    release_ready_status: "Mark release ready",
  };
  return labels[key] ?? clean(key);
}

function deriveNextAction(row) {
  const blocked = EXECUTABLE_STATUS_COLUMNS.find((key) => normalize(row[key]) === "BLOCKED");
  if (blocked) {
    const detailKey = blocked === "asc_submission_status"
      ? "asc_submission_evidence"
      : blocked === "gplay_submission_status"
        ? "gplay_submission_evidence"
        : "";
    const reason = detailKey ? extractReason(row[detailKey]) : "";
    return reason
      ? `Unblock ${labelForStatusColumn(blocked)}: ${reason}`
      : `Unblock ${labelForStatusColumn(blocked)}`;
  }

  const next = firstPendingLifecycle(row);
  if (!next) return "Row complete";

  if (normalize(row.row_overall_status) === "READY" && normalize(row.next_row_permission) !== "GO") {
    return `${labelForStatusColumn(next)} after permission is set to GO`;
  }

  return labelForStatusColumn(next);
}

function canonicalProjectKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sortRows(rows) {
  const preferred = [
    "routemaster",
    "bloomsteward",
    "poolsteward",
    "pulltabvalet",
    "dvdvalet",
  ];
  const rank = new Map(preferred.map((key, index) => [key, index]));

  return [...rows].sort((a, b) => {
    const ak = canonicalProjectKey(a.project);
    const bk = canonicalProjectKey(b.project);
    const ar = rank.has(ak) ? rank.get(ak) : Number.MAX_SAFE_INTEGER;
    const br = rank.has(bk) ? rank.get(bk) : Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    return clean(a.project).localeCompare(clean(b.project));
  });
}

function toTrackerRows(rows) {
  return sortRows(rows).map((row) => ({
    "Project Name": clean(row.project),
    Overall: clean(row.row_overall_status),
    Permission: clean(row.next_row_permission),
    Repo: hasRepoArtifact(row, "repo_path") ? "Y" : "N",
    "Local .ipa": hasRepoArtifact(row, "ipa_path") ? "Y" : "N",
    "Local .aab": hasRepoArtifact(row, "aab_path") ? "Y" : "N",
    "iOS Test": clean(row.test_ios_device_status),
    "Android Test": clean(row.test_android_device_status),
    "ASC Submit": clean(row.asc_submission_status),
    "ASC Verify":
      normalize(row.asc_submission_status) === "DONE" && hasEvidence(row.asc_submission_evidence)
        ? "DONE"
        : "PENDING",
    "GPlay Submit": clean(row.gplay_submission_status),
    "GPlay Verify":
      normalize(row.gplay_submission_status) === "DONE" && hasEvidence(row.gplay_submission_evidence)
        ? "DONE"
        : "PENDING",
    CI: clean(row.ci_pipeline_status),
    Release: clean(row.release_ready_status),
    "Progress %": progressPercent(row),
    "Next Action": deriveNextAction(row),
    Notes: deriveNotes(row),
  }));
}

function cellColorForValue(value) {
  const v = normalize(value);
  if (v === "DONE") {
    return { red: 0.80, green: 0.94, blue: 0.80 };
  }
  if (v === "PAUSE" || v === "PENDING" || v === "READY") {
    return { red: 1.0, green: 0.95, blue: 0.75 };
  }
  return null;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlClassForValue(value) {
  const v = normalize(value);
  if (v === "DONE") return "cell-done";
  if (v === "PAUSE" || v === "PENDING" || v === "READY") return "cell-pending";
  return "";
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function statusClassName(value) {
  const v = normalize(value);
  if (v === "DONE") return "status-done";
  if (v === "READY") return "status-ready";
  if (v === "RUNNING") return "status-running";
  if (v === "BLOCKED") return "status-blocked";
  return "status-pending";
}

function writeHtmlView(headers, trackerRows, sourceRows) {
  const rowsByProject = new Map(sourceRows.map((row) => [clean(row.project), row]));
  const statusColumns = new Set([
    "Overall",
    "Permission",
    "iOS Test",
    "Android Test",
    "ASC Submit",
    "ASC Verify",
    "GPlay Submit",
    "GPlay Verify",
    "CI",
    "Release",
  ]);

  const enrichedRows = trackerRows.map((row) => {
    const project = clean(row["Project Name"]);
    const source = rowsByProject.get(project) ?? {};
    const progress = Number.parseInt(String(row["Progress %"] ?? "0").replace(/[^\d]/g, ""), 10) || 0;
    return {
      ...row,
      __project: project,
      __overall: clean(row.Overall),
      __progress: progress,
      __nextAction: deriveNextAction(source),
    };
  });

  const totalProjects = enrichedRows.length;
  const readyProjects = enrichedRows.filter((row) => normalize(row.__overall) === "READY").length;
  const blockedProjects = enrichedRows.filter((row) => normalize(row.__overall) === "BLOCKED").length;
  const doneProjects = enrichedRows.filter((row) => normalize(row.__overall) === "DONE").length;
  const nextReadyRow = enrichedRows.find((row) => normalize(row.__overall) === "READY");
  const thead = headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("");
  const bodyRows = enrichedRows
    .map((row) => {
      const cells = headers
        .map((header) => {
          const value = row[header] ?? "";
          if (header === "Progress %") {
            return `<td class="cell cell-progress" data-progress="${row.__progress}">
              <div class="progress-stack">
                <strong>${row.__progress}%</strong>
                <div class="bar"><span style="width:${row.__progress}%"></span></div>
              </div>
            </td>`;
          }

          if (statusColumns.has(header)) {
            return `<td class="cell"><span class="chip ${statusClassName(value)}">${htmlEscape(clean(value) || "PENDING")}</span></td>`;
          }

          const classNames = ["cell"];
          if (header === "Project Name") classNames.push("cell-project");
          if (header === "Next Action") classNames.push("cell-next-action");
          if (header === "Notes") classNames.push("cell-notes");
          const valueClass = htmlClassForValue(value);
          if (valueClass) classNames.push(valueClass);
          return `<td class="${classNames.join(" ")}">${htmlEscape(value)}</td>`;
        })
        .join("");
      return `<tr data-project="${htmlEscape(row.__project)}" data-overall="${htmlEscape(row.__overall)}" data-next-action="${htmlEscape(row.__nextAction)}">${cells}</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Action Grid Tracker</title>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap");

    :root {
      color-scheme: light;
      --bg: #f6f2ea;
      --panel: #fffdfa;
      --panel-soft: #f7f1e7;
      --ink: #1f2329;
      --muted: #56606d;
      --line: #d8d2c6;
      --done: #d8f3dc;
      --ready: #fff3bf;
      --running: #dbeafe;
      --blocked: #ffe3e3;
      --pending: #eceff4;
      --shadow: 0 10px 30px rgba(24, 28, 35, 0.08);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 24px;
      font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 15% 0%, #efe4d2 0%, rgba(239, 228, 210, 0) 33%),
        radial-gradient(circle at 100% 10%, #dfeadf 0%, rgba(223, 234, 223, 0) 28%),
        var(--bg);
      color: var(--ink);
    }

    .wrap {
      max-width: 1700px;
      margin: 0 auto;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
      gap: 16px;
      margin-bottom: 18px;
    }

    .hero-panel,
    .summary-panel,
    .table-shell {
      background: rgba(255, 253, 250, 0.92);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .hero-panel {
      padding: 20px;
    }

    .eyebrow {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #7a6846;
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(1.5rem, 3vw, 2.35rem);
      line-height: 1.05;
    }

    .meta {
      margin: 0;
      color: var(--muted);
      font-size: 0.95rem;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .metric {
      background: var(--panel-soft);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px 14px;
    }

    .metric dt {
      margin: 0 0 6px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .metric dd {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .summary-panel {
      padding: 18px;
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .summary-item {
      border-top: 1px solid var(--line);
      padding-top: 12px;
    }

    .summary-item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .summary-kicker {
      margin: 0 0 4px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .summary-main {
      margin: 0;
      font-weight: 700;
    }

    .summary-sub {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 12px;
      margin-bottom: 14px;
    }

    .controls input,
    .controls select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(255, 253, 250, 0.9);
      color: var(--ink);
      padding: 12px 14px;
      font: inherit;
      outline: none;
      box-shadow: 0 4px 18px rgba(24, 28, 35, 0.04);
    }

    .controls input:focus,
    .controls select:focus {
      border-color: #8e7a54;
      box-shadow: 0 0 0 3px rgba(142, 122, 84, 0.16);
    }

    .table-shell {
      overflow: auto;
      max-height: 72vh;
    }

    table {
      border-collapse: separate;
      border-spacing: 0;
      min-width: 1320px;
      width: max-content;
    }

    th,
    td {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      text-align: left;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.92);
      white-space: nowrap;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #f2ede2;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    th:first-child,
    td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      background: #fffefa;
    }

    th:first-child {
      z-index: 4;
      background: #ece3d2;
    }

    tbody tr:nth-child(even) td {
      background: rgba(255, 253, 249, 0.95);
    }

    tbody tr[data-overall="BLOCKED"] td:first-child {
      background: #fff4f4;
    }

    .cell-project {
      min-width: 190px;
      font-weight: 700;
    }

    .cell-notes {
      white-space: normal;
      min-width: 320px;
      max-width: 420px;
      color: var(--muted);
    }

    .cell-next-action {
      white-space: normal;
      min-width: 280px;
      max-width: 380px;
      color: var(--ink);
    }

    .cell-done {
      background: #f4fcf5;
    }

    .cell-pending {
      background: #fffdf6;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid transparent;
    }

    .status-done { background: var(--done); border-color: #9fddb0; }
    .status-ready { background: var(--ready); border-color: #e2c866; }
    .status-running { background: var(--running); border-color: #93c5fd; }
    .status-blocked { background: var(--blocked); border-color: #ffb3b3; }
    .status-pending { background: var(--pending); border-color: #cfd6df; }

    .progress-stack {
      min-width: 110px;
      display: grid;
      gap: 4px;
    }

    .bar {
      height: 6px;
      border-radius: 999px;
      background: #ece5d8;
      overflow: hidden;
    }

    .bar > span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #8e7a54, #5f8b74);
    }

    @media (max-width: 980px) {
      body { padding: 14px; }
      .hero { grid-template-columns: 1fr; }
      .hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .controls { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="hero-panel">
        <p class="eyebrow">Canonical Source: action-grid/projects.csv</p>
        <h1>Action Grid Tracker</h1>
        <p class="meta">This dashboard is generated from the project CSV and mirrored into Canopi, so the HTML stays a view layer rather than turning into a second source of truth.</p>
        <dl class="hero-grid">
          <div class="metric"><dt>Total Projects</dt><dd>${totalProjects}</dd></div>
          <div class="metric"><dt>Ready Queue</dt><dd>${readyProjects}</dd></div>
          <div class="metric"><dt>Blocked</dt><dd>${blockedProjects}</dd></div>
          <div class="metric"><dt>Complete</dt><dd>${doneProjects}</dd></div>
        </dl>
      </div>
      <aside class="summary-panel">
        <div class="summary-item">
          <p class="summary-kicker">Next Up</p>
          <p class="summary-main">${htmlEscape(nextReadyRow?.__project ?? "No READY project")}</p>
          <p class="summary-sub">${htmlEscape(nextReadyRow?.__nextAction ?? "Nothing is queued right now.")}</p>
        </div>
        <div class="summary-item">
          <p class="summary-kicker">Blocked Focus</p>
          <p class="summary-main">${blockedProjects} project${blockedProjects === 1 ? "" : "s"} need manual intervention</p>
          <p class="summary-sub">Store submission blockers are the main reason rows are not advancing automatically.</p>
        </div>
        <div class="summary-item">
          <p class="summary-kicker">Open This View</p>
          <p class="summary-main">Root or action-grid</p>
          <p class="summary-sub">Both HTML files are regenerated together from the same CSV snapshot.</p>
        </div>
      </aside>
    </section>

    <div class="controls">
      <input id="search" type="search" placeholder="Filter by project, notes, or next action..." />
      <select id="overallFilter">
        <option value="">All Overall States</option>
        <option value="READY">READY</option>
        <option value="RUNNING">RUNNING</option>
        <option value="BLOCKED">BLOCKED</option>
        <option value="DONE">DONE</option>
        <option value="BACKLOG">BACKLOG</option>
      </select>
    </div>

    <div class="table-shell">
      <table>
        <thead><tr>${thead}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
  <script>
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const search = document.getElementById("search");
    const overallFilter = document.getElementById("overallFilter");

    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      const overall = overallFilter.value.trim().toUpperCase();

      rows.forEach((row) => {
        const haystack = [
          row.dataset.project || "",
          row.dataset.overall || "",
          row.dataset.nextAction || "",
          row.textContent || "",
        ].join(" ").toLowerCase();
        const rowOverall = (row.dataset.overall || "").toUpperCase();
        const matchesQuery = !query || haystack.includes(query);
        const matchesOverall = !overall || rowOverall === overall;
        row.style.display = matchesQuery && matchesOverall ? "" : "none";
      });
    }

    search.addEventListener("input", applyFilters);
    overallFilter.addEventListener("change", applyFilters);
  </script>
</body>
</html>
`;

  fs.writeFileSync(OUTPUT_HTML_PATH, html, "utf8");
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function resolvePrivateKey(rawKey) {
  const key = String(rawKey ?? "").trim();
  if (!key) return "";
  return key.replace(/\\n/g, "\n");
}

async function fetchGoogleAccessToken() {
  const clientEmail = clean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKey = resolvePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const tokenUri = clean(process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI) || "https://oauth2.googleapis.com/token";

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY for Google Sheets sync.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google OAuth request failed (${resp.status}): ${text.slice(0, 220)}`);
  }

  const json = await resp.json();
  const accessToken = clean(json?.access_token);
  if (!accessToken) {
    throw new Error("Google OAuth response missing access_token.");
  }
  return accessToken;
}

async function clearSheet(token, spreadsheetId, tabName) {
  const range = encodeURIComponent(`${tabName}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:clear`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets clear failed (${resp.status}): ${text.slice(0, 220)}`);
  }
}

async function updateSheet(token, spreadsheetId, tabName, values) {
  const range = encodeURIComponent(`${tabName}!A1`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${range}?valueInputOption=RAW`;

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      range: `${tabName}!A1`,
      majorDimension: "ROWS",
      values,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets update failed (${resp.status}): ${text.slice(0, 220)}`);
  }
}

async function resolveSheetId(token, spreadsheetId, tabName) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    "?fields=sheets(properties(sheetId,title))";
  const resp = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets metadata read failed (${resp.status}): ${text.slice(0, 220)}`);
  }
  const json = await resp.json();
  const sheets = Array.isArray(json?.sheets) ? json.sheets : [];
  const found = sheets.find((sheet) => clean(sheet?.properties?.title) === tabName);
  const sheetId = Number(found?.properties?.sheetId);
  if (!Number.isFinite(sheetId)) {
    throw new Error(`Google Sheet tab not found: ${tabName}`);
  }
  return sheetId;
}

async function applySheetFormatting(token, spreadsheetId, sheetId, values) {
  const rowCount = values.length;
  const colCount = values[0]?.length ?? 0;
  if (!rowCount || !colCount) return;

  const requests = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
            frozenColumnCount: 1,
          },
        },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 },
            textFormat: { bold: true },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat.bold)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
            textFormat: { bold: false },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat.bold)",
      },
    },
  ];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < values[rowIndex].length; colIndex += 1) {
      const color = cellColorForValue(values[rowIndex][colIndex]);
      if (!color) continue;
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1,
          },
          cell: { userEnteredFormat: { backgroundColor: color } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets formatting failed (${resp.status}): ${text.slice(0, 220)}`);
  }
}

async function maybeSyncToGoogleSheet(trackerRows) {
  const spreadsheetId = clean(process.env.ACTION_GRID_GOOGLE_SHEET_ID);
  if (!spreadsheetId) {
    return "Skipping Google Sheet sync (ACTION_GRID_GOOGLE_SHEET_ID not set).";
  }

  const tabName = clean(process.env.ACTION_GRID_GOOGLE_SHEET_TAB) || "Tracker";
  const headers = Object.keys(trackerRows[0] ?? {});
  const values = [headers, ...trackerRows.map((row) => headers.map((header) => row[header] ?? ""))];

  const token = await fetchGoogleAccessToken();
  await clearSheet(token, spreadsheetId, tabName);
  await updateSheet(token, spreadsheetId, tabName, values);
  const sheetId = await resolveSheetId(token, spreadsheetId, tabName);
  await applySheetFormatting(token, spreadsheetId, sheetId, values);
  return `Google Sheet synced (${tabName}, ${trackerRows.length} rows).`;
}

async function main() {
  const { rows } = readCsv(CSV_PATH);
  const trackerRows = toTrackerRows(rows);
  const header = Object.keys(trackerRows[0] ?? {
    "Project Name": "",
    Overall: "",
    Permission: "",
    Repo: "",
    "Local .ipa": "",
    "Local .aab": "",
    "iOS Test": "",
    "Android Test": "",
    "ASC Submit": "",
    "ASC Verify": "",
    "GPlay Submit": "",
    "GPlay Verify": "",
    CI: "",
    Release: "",
    "Progress %": "",
    "Next Action": "",
    Notes: "",
  });

  writeCsv(OUTPUT_PATH, header, trackerRows);
  writeHtmlView(header, trackerRows, rows);
  ensureDirectory(CANOPI_DIR);
  fs.copyFileSync(CSV_PATH, CANOPI_PROJECTS_PATH);
  fs.copyFileSync(OUTPUT_HTML_PATH, CANOPI_HTML_PATH);
  console.log(`Tracker CSV written: ${OUTPUT_PATH}`);
  console.log(`Tracker HTML written: ${OUTPUT_HTML_PATH}`);
  console.log(`Canopi projects mirror written: ${CANOPI_PROJECTS_PATH}`);
  console.log(`Canopi HTML mirror written: ${CANOPI_HTML_PATH}`);
  const syncResult = await maybeSyncToGoogleSheet(trackerRows);
  console.log(syncResult);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
