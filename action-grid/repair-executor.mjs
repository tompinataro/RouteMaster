#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { readCsv, writeCsv } from "./csv-utils.mjs";

const project = process.env.ACTION_GRID_PROJECT;
const repo = process.env.ACTION_GRID_REPO_PATH;
const statusColumn = process.env.ACTION_GRID_STATUS_COLUMN;
const csvPath = process.env.ACTION_GRID_CSV_PATH;
const EXECUTABLE_STATUS_COLUMNS = [
  "build_ios_ipa_status",
  "build_android_aab_status",
  "asc_submission_status",
  "gplay_submission_status",
  "ci_pipeline_status",
  "release_ready_status",
];

function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isNonEmpty(value) {
  return String(value ?? "").trim().length > 0;
}

function isIntegerString(value) {
  return /^\d+$/.test(String(value ?? "").trim());
}

function looksLikePackageName(value) {
  return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(String(value ?? "").trim());
}

function hasRealEvidence(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (/^(todo|tbd|n\/a|na|none|unknown|pending)$/i.test(raw)) return false;
  return true;
}

function isPlaceholderPath(value) {
  return String(value ?? "").includes("REPLACE_WITH_REAL_PATH");
}

function existsFile(p) {
  if (!isNonEmpty(p)) return false;
  try {
    return fs.existsSync(String(p));
  } catch {
    return false;
  }
}

function newestArtifact(repoPath, ext) {
  const stack = [repoPath];
  let best = null;

  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(ext)) continue;
      const mtime = fs.statSync(full).mtimeMs;
      if (!best || mtime > best.mtime) best = { path: full, mtime };
    }
  }

  return best?.path ?? "";
}

function fail(row, header, rows, reason, guidance) {
  row[statusColumn] = "BLOCKED";
  row.row_overall_status = "BLOCKED";
  row.next_row_permission = "PAUSE";
  writeCsv(csvPath, header, rows);
  const msg =
    `BLOCKED: ${reason}\n` +
    `Action: ${guidance}\n` +
    `Project: ${project}\n` +
    `Task: ${statusColumn}`;
  console.error(msg);
  process.exit(1);
}

function requireCoreInputs(row, header, rows) {
  if (!isNonEmpty(project) || !isNonEmpty(statusColumn) || !isNonEmpty(csvPath)) {
    fail(
      row,
      header,
      rows,
      "Missing required executor env vars.",
      "Ensure ACTION_GRID_PROJECT, ACTION_GRID_STATUS_COLUMN, and ACTION_GRID_CSV_PATH are set by runner.",
    );
  }
  if (!isNonEmpty(repo) || isPlaceholderPath(repo) || !fs.existsSync(repo)) {
    fail(
      row,
      header,
      rows,
      `Invalid repo path: ${repo || "(empty)"}`,
      "Set a real repo_path in action-grid/projects.csv and re-run.",
    );
  }
}

function markDone(row, header, rows) {
  row[statusColumn] = "DONE";
  const completedKey = statusColumn.replace(/_status$/, "_completed_at");
  if (completedKey in row && !isNonEmpty(row[completedKey])) row[completedKey] = now();
  if (EXECUTABLE_STATUS_COLUMNS.every((k) => String(row[k] ?? "").toUpperCase() === "DONE")) {
    row.row_overall_status = "DONE";
    row.next_row_permission = "PAUSE";
  }
  writeCsv(csvPath, header, rows);
}

function ensureGitCommit(repoPath, message) {
  try {
    execSync(`cd "${repoPath}" && git add -A`, { stdio: "ignore" });
    execSync(`cd "${repoPath}" && git diff --cached --quiet || git commit -m "${message}"`, {
      stdio: "ignore",
    });
  } catch {
    // Non-fatal for task status outcomes.
  }
}

function validateAndRepair(row, header, rows) {
  switch (statusColumn) {
    case "build_ios_ipa_status": {
      if (!isNonEmpty(row.ipa_path) || !existsFile(row.ipa_path)) {
        const found = newestArtifact(repo, ".ipa");
        if (found) row.ipa_path = found;
      }
      if (!isNonEmpty(row.ipa_path) || !existsFile(row.ipa_path)) {
        fail(
          row,
          header,
          rows,
          "No iOS IPA artifact found.",
          "Build an IPA for this project and write its absolute path to ipa_path.",
        );
      }
      break;
    }
    case "build_android_aab_status": {
      if (!isNonEmpty(row.aab_path) || !existsFile(row.aab_path)) {
        const found = newestArtifact(repo, ".aab");
        if (found) row.aab_path = found;
      }
      if (!isNonEmpty(row.aab_path) || !existsFile(row.aab_path)) {
        fail(
          row,
          header,
          rows,
          "No Android AAB artifact found.",
          "Build an AAB for this project and write its absolute path to aab_path.",
        );
      }
      break;
    }
    case "asc_submission_status": {
      if (!isNonEmpty(row.ipa_path) || !existsFile(row.ipa_path)) {
        fail(
          row,
          header,
          rows,
          "ASC submission requires a valid ipa_path artifact.",
          "Complete build_ios_ipa_status with a real IPA path first.",
        );
      }
      if (!isNonEmpty(row.asc_app_id) || !isNonEmpty(row.asc_build_number)) {
        fail(
          row,
          header,
          rows,
          "ASC metadata missing (asc_app_id and/or asc_build_number).",
          "Populate asc_app_id and asc_build_number after App Store Connect submission.",
        );
      }
      if (!isIntegerString(row.asc_app_id)) {
        fail(
          row,
          header,
          rows,
          `ASC app id must be numeric (got: ${row.asc_app_id || "(empty)"}).`,
          "Set asc_app_id to the numeric App Store Connect app id.",
        );
      }
      if (!hasRealEvidence(row.asc_submission_evidence)) {
        fail(
          row,
          header,
          rows,
          "ASC submission evidence missing.",
          "Set asc_submission_evidence to a real reference (build id, submission id, or ASC/TestFlight URL).",
        );
      }
      break;
    }
    case "gplay_submission_status": {
      if (!isNonEmpty(row.aab_path) || !existsFile(row.aab_path)) {
        fail(
          row,
          header,
          rows,
          "Google Play submission requires a valid aab_path artifact.",
          "Complete build_android_aab_status with a real AAB path first.",
        );
      }
      if (!isNonEmpty(row.gplay_package_name) || !isNonEmpty(row.gplay_version_code)) {
        fail(
          row,
          header,
          rows,
          "Google Play metadata missing (gplay_package_name and/or gplay_version_code).",
          "Populate gplay_package_name and gplay_version_code after Play Console submission.",
        );
      }
      if (!looksLikePackageName(row.gplay_package_name)) {
        fail(
          row,
          header,
          rows,
          `Google Play package name format is invalid (got: ${row.gplay_package_name || "(empty)"}).`,
          "Set gplay_package_name to a valid package id, for example com.company.app.",
        );
      }
      if (!isIntegerString(row.gplay_version_code)) {
        fail(
          row,
          header,
          rows,
          `Google Play version code must be numeric (got: ${row.gplay_version_code || "(empty)"}).`,
          "Set gplay_version_code to the integer versionCode submitted to Play Console.",
        );
      }
      if (!hasRealEvidence(row.gplay_submission_evidence)) {
        fail(
          row,
          header,
          rows,
          "Google Play submission evidence missing.",
          "Set gplay_submission_evidence to a real reference (edit id, release id, track URL, or console link).",
        );
      }
      break;
    }
    case "ci_pipeline_status": {
      const hasCiFolder = fs.existsSync(path.join(repo, ".github", "workflows"));
      if (!hasCiFolder) {
        fail(
          row,
          header,
          rows,
          "CI workflow folder not found (.github/workflows).",
          "Add/restore CI workflows or adjust repo_path to the correct repository root.",
        );
      }
      break;
    }
    case "release_ready_status": {
      const prereqStatuses = [
        "build_ios_ipa_status",
        "build_android_aab_status",
        "asc_submission_status",
        "gplay_submission_status",
        "ci_pipeline_status",
      ];
      const notDone = prereqStatuses.filter((s) => String(row[s] ?? "").toUpperCase() !== "DONE");
      if (notDone.length) {
        fail(
          row,
          header,
          rows,
          `Release prerequisites not DONE: ${notDone.join(", ")}`,
          "Complete prior lifecycle tasks before marking release_ready_status.",
        );
      }
      break;
    }
    default: {
      fail(
        row,
        header,
        rows,
        `Unsupported status column: ${statusColumn}`,
        "Update repair-executor.mjs with a handler for this status task.",
      );
    }
  }
}

function main() {
  const { header, rows } = readCsv(csvPath);
  const row = rows.find((r) => String(r.project).trim() === String(project).trim());
  if (!row) {
    console.error(`BLOCKED: Project not found in CSV: ${project}`);
    process.exit(1);
  }

  requireCoreInputs(row, header, rows);
  validateAndRepair(row, header, rows);
  markDone(row, header, rows);
  ensureGitCommit(repo, `automated ${statusColumn} validation repair`);
  console.log(`Repair complete for ${project} (${statusColumn})`);
}

main();
