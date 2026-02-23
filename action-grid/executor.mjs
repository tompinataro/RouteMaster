#!/usr/bin/env node
import { readCsv, writeCsv } from "./csv-utils.mjs";

const project = process.env.ACTION_GRID_PROJECT || "";
const statusColumn = process.env.ACTION_GRID_STATUS_COLUMN || "";
const csvPath = process.env.ACTION_GRID_CSV_PATH || "";

if (!project || !statusColumn || !csvPath) {
  console.error("Missing required env vars: ACTION_GRID_PROJECT, ACTION_GRID_STATUS_COLUMN, ACTION_GRID_CSV_PATH");
  process.exit(2);
}

// Minimal "dry-run" executor:
// - Does NOT run builds.
// - Marks the requested statusColumn as DONE.
// - Leaves metadata columns empty (for now).
// This is to prove the action-grid orchestration works end-to-end safely.

const { header, rows } = readCsv(csvPath);
const row = rows.find(r => String(r.project || "").trim() === String(project).trim());

if (!row) {
  console.error(`Project not found in CSV: ${project}`);
  process.exit(3);
}

row[statusColumn] = "DONE";

writeCsv(csvPath, header, rows);
console.log(`OK: ${project} set ${statusColumn}=DONE (dry-run executor)`);
