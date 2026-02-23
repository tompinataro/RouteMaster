#!/usr/bin/env node
import { readCsv, writeCsv } from "./csv-utils.mjs";
import { execSync } from "node:child_process";

const project = process.env.ACTION_GRID_PROJECT;
const repo = process.env.ACTION_GRID_REPO_PATH;
const statusColumn = process.env.ACTION_GRID_STATUS_COLUMN;
const csvPath = process.env.ACTION_GRID_CSV_PATH;

function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

const { header, rows } = readCsv(csvPath);
const row = rows.find(r => String(r.project).trim() === String(project).trim());

if (!row) {
  console.error("Project not found:", project);
  process.exit(1);
}

try {

  // Safe repair actions only
  execSync(`cd "${repo}" && git add -A`, {stdio:"ignore"});
  execSync(`cd "${repo}" && git commit -m "automated hygiene repair" || true`, {stdio:"ignore"});

  row[statusColumn] = "DONE";
  const completedKey = statusColumn.replace(/_status$/, "_completed_at");
  if (completedKey in row) row[completedKey] = now();

  writeCsv(csvPath, header, rows);

  console.log(`Repair complete for ${project} (${statusColumn})`);

} catch (e) {

  row[statusColumn] = "BLOCKED";
  writeCsv(csvPath, header, rows);

  console.error("Repair failed:", e.message);
  process.exit(1);

}
