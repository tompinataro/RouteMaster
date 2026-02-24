#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { readCsv, writeCsv } from "./csv-utils.mjs";
import { getTelegramUpdates, sendTelegramMessage } from "./telegram-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const NODE_BIN_DIR = path.dirname(process.execPath);
const DEFAULT_NPM_BIN = path.join(NODE_BIN_DIR, "npm");

const CSV_PATH = path.join(__dirname, "projects.csv");
const ENV_PATH = path.join(__dirname, ".env");
const PID_PATH = path.join(__dirname, "daemon.pid");
const LOG_PATH = path.join(__dirname, "daemon.log");
const OFFSET_PATH = path.join(__dirname, ".telegram-offset");
const TIMER_MS = 30_000;
const LONG_POLL_SECONDS = 25;
const POLL_RETRY_DELAY_MS = 1_000;
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

let shuttingDown = false;
let timerHandle = null;
let pollerStarted = false;
let runnerChain = Promise.resolve({ code: 0, signal: null });

function nowIso() {
  return new Date().toISOString();
}

function log(message) {
  fs.appendFileSync(LOG_PATH, `[${nowIso()}] ${message}\n`);
}

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function shellQuote(value) {
  return `'${String(value ?? "").replace(/'/g, `'\"'\"'`)}'`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readOffset() {
  try {
    const raw = fs.readFileSync(OFFSET_PATH, "utf8").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeOffset(offset) {
  fs.writeFileSync(OFFSET_PATH, String(offset));
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPidFile() {
  try {
    const raw = fs.readFileSync(PID_PATH, "utf8").trim();
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function lockFileAgeMs() {
  try {
    const stats = fs.statSync(PID_PATH);
    return Math.max(0, Date.now() - stats.mtimeMs);
  } catch {
    return null;
  }
}

function acquireLock() {
  const writePid = () => {
    const fd = fs.openSync(PID_PATH, "wx");
    fs.writeFileSync(fd, `${process.pid}\n`);
    fs.closeSync(fd);
  };

  try {
    writePid();
    return true;
  } catch (err) {
    if (err?.code !== "EEXIST") throw err;
    const existingPid = readPidFile();
    if (existingPid && isPidRunning(existingPid)) {
      log(`daemon already running (pid=${existingPid}); exiting cleanly`);
      return false;
    }
    const ageMs = lockFileAgeMs();

    if (!existingPid) {
      if (ageMs !== null && ageMs < 5_000) {
        log("daemon lock file exists but owner pid is not readable yet; exiting to avoid duplicate pollers");
        return false;
      }
      log("daemon lock file appears stale without owner pid; attempting lock recovery");
    } else {
      log(`daemon lock has stale pid=${existingPid}; attempting lock recovery`);
    }

    try {
      fs.unlinkSync(PID_PATH);
    } catch (unlinkErr) {
      if (unlinkErr?.code !== "ENOENT") throw unlinkErr;
    }

    try {
      writePid();
      return true;
    } catch (retryErr) {
      if (retryErr?.code === "EEXIST") {
        const pid = readPidFile();
        log(`daemon lock lost to another process (pid=${pid ?? "unknown"}); exiting`);
        return false;
      }
      throw retryErr;
    }
  }
}

function releaseLock() {
  const current = readPidFile();
  if (current === process.pid) {
    fs.rmSync(PID_PATH, { force: true });
  }
}

function ensureEnv() {
  const required = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "ACTION_GRID_EXECUTOR"];
  const missing = required.filter((name) => !String(process.env[name] ?? "").trim());
  if (missing.length) {
    log(`missing required env vars: ${missing.join(", ")}; exiting`);
    return false;
  }
  return true;
}

function loadActionGridEnv() {
  dotenv.config({ path: ENV_PATH, override: false });
}

function hasReadyGoRow() {
  const { rows } = readCsv(CSV_PATH);
  return rows.some(
    (row) =>
      normalize(row.row_overall_status) === "READY" &&
      normalize(row.next_row_permission) === "GO",
  );
}

function findNextEligibleRowIndex(rows) {
  const nextStart = rows.reduce(
    (lastDone, row, index) =>
      normalize(row.row_overall_status) === "DONE" ? index : lastDone,
    -1,
  ) + 1;

  for (let i = nextStart; i < rows.length; i += 1) {
    const status = normalize(rows[i].row_overall_status);
    const permission = normalize(rows[i].next_row_permission);
    if (status === "DONE" || status === "BLOCKED") continue;
    if (permission === "PAUSE") continue;
    return i;
  }
  return -1;
}

function promoteNextEligibleRow() {
  const { header, rows } = readCsv(CSV_PATH);
  const existingReadyGo = rows.findIndex(
    (row) =>
      normalize(row.row_overall_status) === "READY" &&
      normalize(row.next_row_permission) === "GO",
  );

  if (existingReadyGo >= 0) {
    return { changed: false, project: rows[existingReadyGo].project ?? "" };
  }

  const targetIndex = findNextEligibleRowIndex(rows);
  if (targetIndex < 0) {
    return { changed: false, project: "" };
  }

  for (const row of rows) {
    row.next_row_permission = "PAUSE";
  }
  rows[targetIndex].row_overall_status = "READY";
  rows[targetIndex].next_row_permission = "GO";
  writeCsv(CSV_PATH, header, rows);
  return { changed: true, project: rows[targetIndex].project ?? "" };
}

function forceProjectReadyGo(projectNameRaw) {
  const projectName = String(projectNameRaw ?? "").trim();
  if (!projectName) return { ok: false, reason: "Project name is empty.", project: "" };

  const { header, rows } = readCsv(CSV_PATH);
  const targetIndex = rows.findIndex(
    (row) => String(row.project ?? "").trim().toLowerCase() === projectName.toLowerCase(),
  );
  if (targetIndex < 0) {
    return { ok: false, reason: `Project not found: ${projectName}`, project: "" };
  }

  if (normalize(rows[targetIndex].row_overall_status) === "BLOCKED") {
    return {
      ok: false,
      reason: `Project is BLOCKED and cannot be started: ${rows[targetIndex].project}`,
      project: rows[targetIndex].project ?? projectName,
    };
  }

  for (const row of rows) {
    row.next_row_permission = "PAUSE";
  }
  rows[targetIndex].row_overall_status = "READY";
  rows[targetIndex].next_row_permission = "GO";
  writeCsv(CSV_PATH, header, rows);
  return { ok: true, reason: "", project: rows[targetIndex].project ?? projectName };
}

function resolveProjectName(projectNameRaw) {
  const projectName = String(projectNameRaw ?? "").trim();
  if (!projectName) return { ok: false, reason: "Project name is empty.", project: "" };

  const { rows } = readCsv(CSV_PATH);
  const row = rows.find(
    (r) => String(r.project ?? "").trim().toLowerCase() === projectName.toLowerCase(),
  );
  if (!row) {
    return { ok: false, reason: `Project not found: ${projectName}`, project: "" };
  }
  return { ok: true, reason: "", project: row.project ?? projectName };
}

function normalizeSetValue(valueRaw) {
  const raw = String(valueRaw ?? "").trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function setProjectField(projectRaw, fieldRaw, valueRaw) {
  const projectName = String(projectRaw ?? "").trim();
  const fieldInput = String(fieldRaw ?? "").trim();
  const value = normalizeSetValue(valueRaw);

  if (!projectName) {
    return { ok: false, reason: "Project name is required." };
  }
  if (!fieldInput) {
    return { ok: false, reason: "Field name is required." };
  }

  const { header, rows } = readCsv(CSV_PATH);
  const row = rows.find(
    (r) => String(r.project ?? "").trim().toLowerCase() === projectName.toLowerCase(),
  );
  if (!row) {
    return { ok: false, reason: `Project not found: ${projectName}` };
  }

  const resolvedField = header.find((h) => h.toLowerCase() === fieldInput.toLowerCase());
  if (!resolvedField) {
    return { ok: false, reason: `Unknown field: ${fieldInput}` };
  }
  if (resolvedField === "project") {
    return { ok: false, reason: "Field 'project' is immutable." };
  }

  let finalValue = value;
  if (resolvedField === "row_overall_status" || resolvedField === "next_row_permission") {
    finalValue = normalize(value);
  }
  if (resolvedField.endsWith("_status")) {
    finalValue = normalize(value);
  }

  row[resolvedField] = finalValue;

  if (resolvedField.endsWith("_status")) {
    if (finalValue === "BLOCKED") {
      row.row_overall_status = "BLOCKED";
      row.next_row_permission = "PAUSE";
    } else if (finalValue === "READY") {
      if (normalize(row.row_overall_status) === "DONE" || normalize(row.row_overall_status) === "BLOCKED") {
        row.row_overall_status = "READY";
      }
    } else if (
      finalValue === "DONE" &&
      EXECUTABLE_STATUS_COLUMNS.every((k) => normalize(row[k]) === "DONE")
    ) {
      row.row_overall_status = "DONE";
      row.next_row_permission = "PAUSE";
    }
  }

  writeCsv(CSV_PATH, header, rows);
  return {
    ok: true,
    project: row.project ?? projectName,
    field: resolvedField,
    value: row[resolvedField] ?? "",
  };
}

function formatListLine(key, value) {
  return `- ${key}: ${String(value ?? "").trim() || "(blank)"}`;
}

function formatProjectSummary(projectRaw) {
  const projectName = String(projectRaw ?? "").trim();
  if (!projectName) {
    return { ok: false, reason: "Project name is required." };
  }

  const { header, rows } = readCsv(CSV_PATH);
  const row = rows.find(
    (r) => String(r.project ?? "").trim().toLowerCase() === projectName.toLowerCase(),
  );
  if (!row) {
    return { ok: false, reason: `Project not found: ${projectName}` };
  }

  const statusFields = header.filter((field) => field.endsWith("_status"));
  const completedFields = header.filter(
    (field) => field.endsWith("_completed_at") && String(row[field] ?? "").trim(),
  );
  const metadataFields = [
    "repo_path",
    "ipa_path",
    "aab_path",
    "ios_test_evidence",
    "android_test_evidence",
    "asc_app_id",
    "asc_build_number",
    "asc_submission_evidence",
    "gplay_package_name",
    "gplay_version_code",
    "gplay_submission_evidence",
    "audit_repo_hygiene_notes",
  ].filter((field) => header.includes(field));

  const lines = [
    `📋 ${row.project ?? projectName}`,
    `row_overall_status: ${String(row.row_overall_status ?? "").trim() || "(blank)"}`,
    `next_row_permission: ${String(row.next_row_permission ?? "").trim() || "(blank)"}`,
    "",
    "Status fields:",
    ...statusFields.map((field) => formatListLine(field, row[field])),
  ];

  if (completedFields.length) {
    lines.push("", "Completed timestamps:");
    lines.push(...completedFields.map((field) => formatListLine(field, row[field])));
  }

  const metadataLines = metadataFields
    .map((field) => [field, String(row[field] ?? "").trim()])
    .filter(([, value]) => value)
    .map(([field, value]) =>
      formatListLine(field, field === "audit_repo_hygiene_notes" ? value.slice(0, 240) : value),
    );

  if (metadataLines.length) {
    lines.push("", "Metadata:");
    lines.push(...metadataLines);
  }

  return { ok: true, project: row.project ?? projectName, message: lines.join("\n") };
}

function formatPortfolioStatus() {
  const { rows } = readCsv(CSV_PATH);
  if (!rows.length) {
    return { ok: true, message: "📊 Action Grid status\nNo project rows found." };
  }

  const counts = new Map();
  for (const row of rows) {
    const state = String(row.row_overall_status ?? "").trim().toUpperCase() || "UNKNOWN";
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }

  const order = ["READY", "RUNNING", "BLOCKED", "DONE", "BACKLOG", "UNKNOWN"];
  const countLine = order
    .filter((key) => counts.has(key))
    .map((key) => `${key}:${counts.get(key)}`)
    .join(" | ");

  const lines = ["📊 Action Grid status", countLine, ""];

  for (const row of rows) {
    const project = String(row.project ?? "").trim() || "(unknown)";
    lines.push(
      `${project} | overall=${String(row.row_overall_status ?? "").trim() || "(blank)"} | permission=${String(row.next_row_permission ?? "").trim() || "(blank)"} | ios=${String(row.build_ios_ipa_status ?? "").trim() || "(blank)"} | android=${String(row.build_android_aab_status ?? "").trim() || "(blank)"} | ios_test=${String(row.test_ios_device_status ?? "").trim() || "(blank)"} | android_test=${String(row.test_android_device_status ?? "").trim() || "(blank)"} | asc=${String(row.asc_submission_status ?? "").trim() || "(blank)"} | gplay=${String(row.gplay_submission_status ?? "").trim() || "(blank)"} | ci=${String(row.ci_pipeline_status ?? "").trim() || "(blank)"} | release=${String(row.release_ready_status ?? "").trim() || "(blank)"}`,
    );
  }

  return { ok: true, message: lines.join("\n") };
}

function formatHelpText() {
  const lines = [
    "🧭 Action Grid help",
    "",
    "Headings:",
    "- overall = row_overall_status (READY/RUNNING/BLOCKED/DONE)",
    "- permission = next_row_permission (GO/PAUSE)",
    "- ios/android = build artifact task statuses",
    "- ios_test/android_test = real device validation task statuses",
    "- ci = CI pipeline task status",
    "- asc/gplay = store submission task statuses",
    "",
    "Commands:",
    "- STATUS",
    "- VERIFY <project>",
    "- SHOW <project>",
    "- RUN <project>",
    "- SET <project> <field> <value>",
    "- YES",
    "- NO",
    "",
    "Examples:",
    "- SHOW pool-steward",
    "- RUN routemaster",
    "- SET routemaster asc_submission_evidence https://appstoreconnect.apple.com/...",
    "- SET routemaster gplay_submission_evidence https://play.google.com/console/...",
  ];
  return lines.join("\n");
}

function runRunnerOnce(reason) {
  return new Promise((resolve) => {
    const npmBin =
      process.env.ACTION_GRID_NPM_BIN ??
      process.env.npm_execpath ??
      (fs.existsSync(DEFAULT_NPM_BIN) ? DEFAULT_NPM_BIN : "npm");

    const child = spawn(npmBin, ["run", "-s", "action-grid:runner"], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    log(`runner start (${reason}) cmd=${npmBin} pid=${child.pid ?? "n/a"}`);

    child.stdout.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      stdout += String(chunk);
      if (text) log(`runner stdout: ${text}`);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      stderr += String(chunk);
      if (text) log(`runner stderr: ${text}`);
    });

    child.on("error", (err) => {
      log(`runner spawn error: ${err?.message ?? String(err)}`);
      finish({ code: 127, signal: null, stdout, stderr: `${stderr}\n${err?.message ?? String(err)}`.trim() });
    });

    child.on("exit", (code, signal) => {
      log(`runner exit code=${code ?? "null"} signal=${signal ?? "null"}`);
      finish({ code: code ?? null, signal: signal ?? null, stdout, stderr });
    });
  });
}

function runVerifierOnce(project, reason) {
  return new Promise((resolve) => {
    const verifierCommand = (process.env.ACTION_GRID_VERIFIER ?? "node action-grid/verify-submissions.mjs").trim();
    const fullCommand = `${verifierCommand} ${shellQuote(project)}`;
    const child = spawn(fullCommand, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ACTION_GRID_PROJECT: project,
        ACTION_GRID_CSV_PATH: CSV_PATH,
      },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    log(`verifier start (${reason}) cmd=${fullCommand} pid=${child.pid ?? "n/a"}`);

    child.stdout.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      stdout += String(chunk);
      if (text) log(`verifier stdout: ${text}`);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      stderr += String(chunk);
      if (text) log(`verifier stderr: ${text}`);
    });

    child.on("error", (err) => {
      log(`verifier spawn error: ${err?.message ?? String(err)}`);
      finish({ code: 127, signal: null, stdout, stderr: `${stderr}\n${err?.message ?? String(err)}`.trim() });
    });

    child.on("exit", (code, signal) => {
      log(`verifier exit code=${code ?? "null"} signal=${signal ?? "null"}`);
      finish({ code: code ?? null, signal: signal ?? null, stdout, stderr });
    });
  });
}

function queueSerial(taskFactory) {
  const runPromise = runnerChain.then(() => taskFactory());
  runnerChain = runPromise.catch(() => ({ code: -1, signal: null, stdout: "", stderr: "" }));
  return runPromise;
}

function queueRunner(reason) {
  return queueSerial(() => runRunnerOnce(reason));
}

function queueVerifier(project, reason) {
  return queueSerial(() => runVerifierOnce(project, reason));
}

function runnerOutcomeText(outcome) {
  if (outcome?.code === 0) return "✅ Runner completed successfully (exit 0).";
  if (outcome?.signal) {
    return `❌ Runner failed (signal ${outcome.signal}).`;
  }
  return `❌ Runner failed (exit ${outcome?.code ?? "unknown"}).`;
}

async function runNowAndReport(chatId, reason) {
  const outcome = await queueRunner(reason);
  await sendTelegramMessage(runnerOutcomeText(outcome), chatId);
}

function verifierOutcomeText(project, outcome) {
  const stdoutLine = String(outcome?.stdout ?? "").trim().split(/\r?\n/).filter(Boolean)[0] ?? "";
  const stderrLine = String(outcome?.stderr ?? "").trim().split(/\r?\n/).filter(Boolean)[0] ?? "";
  if (outcome?.code === 0) {
    return `✅ VERIFY complete for ${project}\n${stdoutLine || "Submission evidence refreshed."}`;
  }
  if (outcome?.signal) {
    return `❌ VERIFY failed for ${project} (signal ${outcome.signal})${stderrLine ? `\n${stderrLine}` : ""}`;
  }
  return `❌ VERIFY failed for ${project} (exit ${outcome?.code ?? "unknown"})${stderrLine ? `\n${stderrLine}` : ""}`;
}

async function runVerifyAndReport(chatId, project, reason) {
  const outcome = await queueVerifier(project, reason);
  await sendTelegramMessage(verifierOutcomeText(project, outcome), chatId);
}

async function handleTelegramMessage(textRaw, chatId) {
  const text = String(textRaw ?? "");
  log(`telegram message received: ${text}`);

  if (/^\s*(HELP|\?)\s*$/i.test(text)) {
    log("HELP -> command summary");
    await sendTelegramMessage(formatHelpText(), chatId);
    return;
  }

  if (/^\s*STATUS(?:\s+ALL)?\s*$/i.test(text)) {
    const summary = formatPortfolioStatus();
    log("STATUS -> portfolio summary");
    await sendTelegramMessage(summary.message, chatId);
    return;
  }

  const verifyMatch = text.match(/^\s*VERIFY\s+(.+?)\s*$/i);
  if (verifyMatch) {
    const resolved = resolveProjectName(verifyMatch[1]);
    if (!resolved.ok) {
      log(`VERIFY -> rejected (${resolved.reason})`);
      await sendTelegramMessage(`❌ ${resolved.reason}`, chatId);
      return;
    }
    log(`VERIFY -> ${resolved.project}`);
    await sendTelegramMessage(`🔎 VERIFY received — checking submissions for ${resolved.project}…`, chatId);
    await runVerifyAndReport(chatId, resolved.project, `telegram-verify-${resolved.project}`);
    return;
  }

  const showMatch = text.match(/^\s*SHOW\s+(.+?)\s*$/i);
  if (showMatch) {
    const summary = formatProjectSummary(showMatch[1]);
    if (!summary.ok) {
      log(`SHOW -> rejected (${summary.reason})`);
      await sendTelegramMessage(`❌ ${summary.reason}`, chatId);
      return;
    }
    log(`SHOW -> ${summary.project}`);
    await sendTelegramMessage(summary.message, chatId);
    return;
  }

  const setMatch = text.match(/^\s*SET\s+(\S+)\s+(\S+)\s+(.+?)\s*$/i);
  if (setMatch) {
    const [, projectInput, fieldInput, valueInput] = setMatch;
    const result = setProjectField(projectInput, fieldInput, valueInput);
    if (!result.ok) {
      log(`SET -> rejected (${result.reason})`);
      await sendTelegramMessage(`❌ ${result.reason}`, chatId);
      return;
    }
    log(`SET -> ${result.project} ${result.field}=${result.value}`);
    await sendTelegramMessage(
      `✅ SET applied: ${result.project} ${result.field}=${result.value}`,
      chatId,
    );
    return;
  }

  const runMatch = text.match(/^\s*RUN\s+(.+?)\s*$/i);
  if (runMatch) {
    const projectRequest = runMatch[1];
    const forced = forceProjectReadyGo(projectRequest);
    if (!forced.ok) {
      log(`RUN -> rejected (${forced.reason})`);
      await sendTelegramMessage(`❌ ${forced.reason}`, chatId);
      return;
    }

    log(`RUN -> forced ${forced.project} to READY+GO`);
    await sendTelegramMessage(
      `✅ RUN received — starting ${forced.project} now…`,
      chatId,
    );
    await runNowAndReport(chatId, `telegram-run-${forced.project}`);
    return;
  }

  if (/^\s*YES\b/i.test(text)) {
    await sendTelegramMessage("✅ YES received — starting next project now…", chatId);
    const promotion = promoteNextEligibleRow();
    if (promotion.project) {
      log(
        promotion.changed
          ? `YES -> promoted ${promotion.project} to READY+GO`
          : `YES -> using existing READY+GO row ${promotion.project}`,
      );
      await runNowAndReport(chatId, "telegram-yes");
      return;
    }
    log("YES -> no eligible row to promote");
    await sendTelegramMessage("❌ No eligible project found to start.", chatId);
    return;
  }

  if (/^\s*NO\b/i.test(text)) {
    log("NO -> paused");
    await sendTelegramMessage("⏸️ Paused — no new project started.", chatId);
  }
}

async function telegramPollLoop() {
  if (pollerStarted) {
    throw new Error("telegram poller already started");
  }
  pollerStarted = true;

  let offset = readOffset();
  log(`telegram poll loop started (offset=${offset ?? "none"})`);

  while (!shuttingDown) {
    const updates = await getTelegramUpdates(offset, LONG_POLL_SECONDS);
    if (!Array.isArray(updates) || updates.length === 0) {
      await sleep(POLL_RETRY_DELAY_MS);
      continue;
    }

    let maxUpdateId = offset ?? -1;
    for (const update of updates) {
      if (typeof update.update_id === "number") {
        maxUpdateId = Math.max(maxUpdateId, update.update_id);
      }
      const text = update?.message?.text ?? "";
      const chatId = update?.message?.chat?.id ?? process.env.TELEGRAM_CHAT_ID;
      await handleTelegramMessage(text, chatId);
    }

    if (maxUpdateId >= 0) {
      offset = maxUpdateId + 1;
      writeOffset(offset);
    }
  }
}

function startTimerLoop() {
  timerHandle = setInterval(() => {
    if (shuttingDown) return;
    if (!hasReadyGoRow()) return;
    void queueRunner("timer-30s");
  }, TIMER_MS);
  log(`timer loop started (${TIMER_MS}ms)`);
}

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`shutdown requested: ${reason}`);
  if (timerHandle) clearInterval(timerHandle);
  releaseLock();
  log("daemon stopped");
  process.exit(0);
}

async function main() {
  loadActionGridEnv();
  if (!acquireLock()) return;
  log(`daemon started pid=${process.pid}`);

  if (!ensureEnv()) {
    releaseLock();
    return;
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
  process.on("uncaughtException", (err) => {
    log(`uncaughtException: ${err?.stack ?? err?.message ?? String(err)}`);
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (err) => {
    log(`unhandledRejection: ${err?.stack ?? err?.message ?? String(err)}`);
    shutdown("unhandledRejection");
  });

  startTimerLoop();
  await telegramPollLoop();
}

main().catch((err) => {
  log(`daemon fatal error: ${err?.stack ?? err?.message ?? String(err)}`);
  shutdown("fatal");
});
