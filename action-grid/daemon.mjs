#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readCsv, writeCsv } from "./csv-utils.mjs";
import { getTelegramUpdates, sendTelegramMessage } from "./telegram-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, "projects.csv");
const PID_PATH = path.join(__dirname, "daemon.pid");
const LOG_PATH = path.join(__dirname, "daemon.log");
const OFFSET_PATH = path.join(__dirname, ".telegram-offset");
const RUNNER_PATH = path.join(__dirname, "runner.mjs");
const TIMER_MS = 30_000;
const LONG_POLL_SECONDS = 25;
const POLL_RETRY_DELAY_MS = 1_000;

let shuttingDown = false;
let timerHandle = null;
let pollerStarted = false;
let runnerBusy = false;
let runnerQueued = false;

function nowIso() {
  return new Date().toISOString();
}

function log(message) {
  fs.appendFileSync(LOG_PATH, `[${nowIso()}] ${message}\n`);
}

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
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
    fs.rmSync(PID_PATH, { force: true });
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
    if (status === "DONE" || status === "BLOCKED") continue;
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

function runRunnerOnce(reason) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER_PATH], {
      cwd: __dirname,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    log(`runner start (${reason}) pid=${child.pid}`);

    child.stdout.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      if (text) log(`runner stdout: ${text}`);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      if (text) log(`runner stderr: ${text}`);
    });

    child.on("exit", (code, signal) => {
      log(`runner exit code=${code ?? "null"} signal=${signal ?? "null"}`);
      resolve();
    });
  });
}

async function triggerRunner(reason) {
  if (runnerBusy) {
    runnerQueued = true;
    log(`runner already busy; queued another run (${reason})`);
    return;
  }

  runnerBusy = true;
  try {
    let loopReason = reason;
    do {
      runnerQueued = false;
      await runRunnerOnce(loopReason);
      loopReason = "queued";
    } while (runnerQueued && !shuttingDown);
  } finally {
    runnerBusy = false;
  }
}

async function handleTelegramMessage(textRaw, chatId) {
  const text = String(textRaw ?? "");
  log(`telegram message received: ${text}`);

  if (/^\s*YES\b/i.test(text)) {
    const promotion = promoteNextEligibleRow();
    if (promotion.project) {
      log(
        promotion.changed
          ? `YES -> promoted ${promotion.project} to READY+GO`
          : `YES -> using existing READY+GO row ${promotion.project}`,
      );
      await sendTelegramMessage("OK — starting next project", chatId);
      await triggerRunner("telegram-yes");
      return;
    }
    log("YES -> no eligible row to promote");
    await sendTelegramMessage("Paused.", chatId);
    return;
  }

  if (/^\s*NO\b/i.test(text)) {
    log("NO -> paused");
    await sendTelegramMessage("Paused.", chatId);
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
    void triggerRunner("timer-30s");
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
