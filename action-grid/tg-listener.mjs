#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv, writeCsv } from "./csv-utils.mjs";
import { getTelegramUpdates, sendTelegramMessage } from "./telegram-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.join(__dirname, "projects.csv");
const OFFSET_PATH = path.join(__dirname, ".telegram-offset");

function readOffset() {
  try {
    const raw = fs.readFileSync(OFFSET_PATH, "utf8").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeOffset(offset) {
  fs.writeFileSync(OFFSET_PATH, String(offset));
}

function normalizeText(value) {
  return String(value ?? "").trim().toUpperCase();
}

function findNextProjectIndexAfterLastDone(rows) {
  let lastDone = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (normalizeText(rows[i].row_overall_status) === "DONE") {
      lastDone = i;
    }
  }

  const start = lastDone + 1;
  if (start < rows.length) return start;
  return -1;
}

async function applyYes() {
  const { header, rows } = readCsv(CSV_PATH);
  const nextIndex = findNextProjectIndexAfterLastDone(rows);
  if (nextIndex < 0) return false;

  for (const row of rows) {
    row.next_row_permission = "PAUSE";
  }
  rows[nextIndex].next_row_permission = "GO";
  if (!normalizeText(rows[nextIndex].row_overall_status)) {
    rows[nextIndex].row_overall_status = "READY";
  }
  writeCsv(CSV_PATH, header, rows);
  return true;
}

async function main() {
  const updates = await getTelegramUpdates(readOffset(), 0);
  if (!updates.length) {
    console.log("No Telegram updates.");
    return;
  }

  let maxId = -1;
  for (const update of updates) {
    if (typeof update.update_id === "number") {
      maxId = Math.max(maxId, update.update_id);
    }
  }

  for (const update of updates) {
    const text = normalizeText(update?.message?.text);
    const chatId = update?.message?.chat?.id;
    if (!chatId) continue;

    if (text === "YES") {
      const ok = await applyYes();
      await sendTelegramMessage(ok ? "OK — starting next project" : "Paused", chatId);
      continue;
    }

    if (text === "NO") {
      await sendTelegramMessage("Paused", chatId);
    }
  }

  if (maxId >= 0) {
    writeOffset(maxId + 1);
  }
}

main().catch(async (err) => {
  console.error(err);
  await sendTelegramMessage(
    `Action-grid tg-listener error\n${err?.message ?? String(err)}`,
  );
  process.exitCode = 1;
});
