#!/usr/bin/env node
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { readCsv, writeCsv } from "./csv-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.join(__dirname, "projects.csv");
const ENV_PATH = path.join(__dirname, ".env");
const OUTPUT_PATH = path.join(__dirname, "tracker-view.csv");

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

function hasArtifactPath(value) {
  const raw = clean(value);
  if (!raw) return false;
  if (/REPLACE_WITH_REAL_PATH/i.test(raw)) return false;
  return true;
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

function sortRows(rows) {
  const rank = { RUNNING: 0, READY: 1, BLOCKED: 2, DONE: 3, BACKLOG: 4 };
  return [...rows].sort((a, b) => {
    const ar = rank[normalize(a.row_overall_status)] ?? 9;
    const br = rank[normalize(b.row_overall_status)] ?? 9;
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
    ASC: clean(row.asc_submission_status),
    GPlay: clean(row.gplay_submission_status),
    CI: clean(row.ci_pipeline_status),
    Release: clean(row.release_ready_status),
    "Progress %": progressPercent(row),
    Notes: deriveNotes(row),
  }));
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
    ASC: "",
    GPlay: "",
    CI: "",
    Release: "",
    "Progress %": "",
    Notes: "",
  });

  writeCsv(OUTPUT_PATH, header, trackerRows);
  console.log(`Tracker CSV written: ${OUTPUT_PATH}`);
  const syncResult = await maybeSyncToGoogleSheet(trackerRows);
  console.log(syncResult);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
