#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readCsv, writeCsv } from "./csv-utils.mjs";
import { sendTelegramMessage } from "./telegram-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.join(__dirname, "projects.csv");

// Only *_status columns are executable lifecycle tasks.
const EXECUTABLE_STATUS_COLUMNS = [
  "build_ios_ipa_status",
  "build_android_aab_status",
  "asc_submission_status",
  "gplay_submission_status",
  "ci_pipeline_status",
  "release_ready_status",
];

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeStatus(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function readTable() {
  return readCsv(CSV_PATH);
}

function writeTable(header, rows) {
  writeCsv(CSV_PATH, header, rows);
}

function findRunnableRowIndex(rows) {
  return rows.findIndex(
    (row) =>
      normalizeStatus(row.row_overall_status) === "READY" &&
      normalizeStatus(row.next_row_permission) === "GO",
  );
}

function findRowByProject(rows, project) {
  return rows.find((row) => row.project === project);
}

function markBlockedAndPersist(header, rows, project, statusColumn, reason) {
  const row = findRowByProject(rows, project);
  if (!row) return;
  row[statusColumn] = "BLOCKED";
  row.row_overall_status = "BLOCKED";
  writeTable(header, rows);
  const message =
    `Action-grid BLOCKED\n` +
    `Project: ${project}\n` +
    `Task: ${statusColumn}\n` +
    `Reason: ${reason}`;
  return sendTelegramMessage(message);
}

function markDoneIfCompletedAtExists(row, statusColumn) {
  if (!statusColumn.endsWith("_status")) return;
  const completedAtKey = statusColumn.replace(/_status$/, "_completed_at");
  if (completedAtKey in row && !String(row[completedAtKey] ?? "").trim()) {
    row[completedAtKey] = nowIso();
  }
}

function runLifecycleTask(row, statusColumn) {
  const executor = (process.env.ACTION_GRID_EXECUTOR ?? "").trim();
  if (!executor) {
    return {
      ok: false,
      reason:
        "ACTION_GRID_EXECUTOR is not set. Provide a command that executes one lifecycle status column.",
    };
  }

  const env = {
    ...process.env,
    ACTION_GRID_PROJECT: String(row.project ?? ""),
    ACTION_GRID_REPO_PATH: String(row.repo_path ?? ""),
    ACTION_GRID_STATUS_COLUMN: statusColumn,
    ACTION_GRID_CSV_PATH: CSV_PATH,
  };

  const result = spawnSync(executor, {
    shell: true,
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    return {
      ok: false,
      reason: `Executor failed with exit code ${result.status ?? "unknown"}.`,
    };
  }
  return { ok: true, reason: "" };
}

async function main() {
  let { header, rows } = readTable();
  const rowIndex = findRunnableRowIndex(rows);
  if (rowIndex < 0) {
    console.log("No READY+GO rows found. Nothing to run.");
    return;
  }

  const project = rows[rowIndex].project;
  rows[rowIndex].row_overall_status = "RUNNING";
  writeTable(header, rows);

  for (const statusColumn of EXECUTABLE_STATUS_COLUMNS) {
    ({ header, rows } = readTable());
    const row = findRowByProject(rows, project);
    if (!row) return;

    const current = normalizeStatus(row[statusColumn]);
    if (current === "DONE") continue;
    if (current === "BLOCKED") {
      row.row_overall_status = "BLOCKED";
      writeTable(header, rows);
      await sendTelegramMessage(
        `Action-grid BLOCKED\nProject: ${project}\nTask: ${statusColumn}\nReason: task is already BLOCKED`,
      );
      return;
    }

    row[statusColumn] = "RUNNING";
    writeTable(header, rows);

    const runResult = runLifecycleTask(row, statusColumn);
    ({ header, rows } = readTable());
    const refreshed = findRowByProject(rows, project);
    if (!refreshed) return;

    const refreshedStatus = normalizeStatus(refreshed[statusColumn]);
    if (!runResult.ok) {
      await markBlockedAndPersist(
        header,
        rows,
        project,
        statusColumn,
        runResult.reason,
      );
      return;
    }

    if (refreshedStatus === "BLOCKED") {
      refreshed.row_overall_status = "BLOCKED";
      writeTable(header, rows);
      await sendTelegramMessage(
        `Action-grid BLOCKED\nProject: ${project}\nTask: ${statusColumn}\nReason: task reported BLOCKED`,
      );
      return;
    }

    if (refreshedStatus !== "DONE") {
      await markBlockedAndPersist(
        header,
        rows,
        project,
        statusColumn,
        `task finished without DONE status (got: ${refreshedStatus || "EMPTY"})`,
      );
      return;
    }

    markDoneIfCompletedAtExists(refreshed, statusColumn);
    writeTable(header, rows);
  }

  ({ header, rows } = readTable());
  const finalRow = findRowByProject(rows, project);
  if (!finalRow) return;

  const allDone = EXECUTABLE_STATUS_COLUMNS.every(
    (statusColumn) => normalizeStatus(finalRow[statusColumn]) === "DONE",
  );

  if (allDone) {
    finalRow.row_overall_status = "DONE";
    finalRow.next_row_permission = "PAUSE";
    writeTable(header, rows);
    await sendTelegramMessage(
      `Action-grid row complete\nProject: ${project}\nrow_overall_status: DONE\nReply YES to run next project, NO to pause.`,
    );
    return;
  }

  finalRow.row_overall_status = "BLOCKED";
  writeTable(header, rows);
  await sendTelegramMessage(
    `Action-grid BLOCKED\nProject: ${project}\nReason: lifecycle tasks ended but not all status columns are DONE.`,
  );
}

main().catch(async (err) => {
  console.error(err);
  await sendTelegramMessage(
    `Action-grid runner error\n${err?.message ?? String(err)}`,
  );
  process.exitCode = 1;
});
