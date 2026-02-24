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

function hasArtifactPath(value) {
  const raw = clean(value);
  if (!raw) return false;
  if (/REPLACE_WITH_REAL_PATH/i.test(raw)) return false;
  try {
    return fs.existsSync(raw);
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
    Repo: hasArtifactPath(row.repo_path) ? "Y" : "N",
    ".ipa": hasArtifactPath(row.ipa_path) ? "Y" : "N",
    ".aab": hasArtifactPath(row.aab_path) ? "Y" : "N",
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

function writeHtmlView(headers, trackerRows) {
  const thead = headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("");
  const bodyRows = trackerRows
    .map((row) => {
      const cells = headers
        .map((header) => {
          const value = row[header] ?? "";
          const className = htmlClassForValue(value);
          return `<td class="${className}">${htmlEscape(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Action Grid Tracker</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6f8; color: #1b1d21; }
    .wrap { max-width: 1600px; margin: 0 auto; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0 0 14px; color: #596273; }
    table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 8px 24px rgba(17,24,39,0.08); }
    th, td { border: 1px solid #d7dce3; padding: 8px 10px; text-align: left; font-size: 13px; }
    th { background: #eef1f5; font-weight: 700; position: sticky; top: 0; z-index: 1; }
    .cell-done { background: #ccf0cc; }
    .cell-pending { background: #fff2bf; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Action Grid Tracker</h1>
    <p>Generated from <code>action-grid/projects.csv</code></p>
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
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
    ".ipa": "",
    ".aab": "",
    "iOS Test": "",
    "Android Test": "",
    "ASC Submit": "",
    "ASC Verify": "",
    "GPlay Submit": "",
    "GPlay Verify": "",
    CI: "",
    Release: "",
    "Progress %": "",
    Notes: "",
  });

  writeCsv(OUTPUT_PATH, header, trackerRows);
  writeHtmlView(header, trackerRows);
  console.log(`Tracker CSV written: ${OUTPUT_PATH}`);
  console.log(`Tracker HTML written: ${OUTPUT_HTML_PATH}`);
  const syncResult = await maybeSyncToGoogleSheet(trackerRows);
  console.log(syncResult);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
