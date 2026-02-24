#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { readCsv } from "./csv-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = process.env.ACTION_GRID_CSV_PATH || path.join(__dirname, "projects.csv");
const ENV_PATH = path.join(__dirname, ".env");

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

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value).toUpperCase();
}

function canonical(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function existsFile(filePath) {
  if (!clean(filePath)) return false;
  try {
    return fs.existsSync(clean(filePath));
  } catch {
    return false;
  }
}

function newestArtifact(repoPath, ext) {
  if (!existsFile(repoPath)) return "";
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

function percentDone(row) {
  const done = EXECUTABLE_STATUS_COLUMNS.filter((key) => normalize(row[key]) === "DONE").length;
  return `${Math.round((done / EXECUTABLE_STATUS_COLUMNS.length) * 100)}%`;
}

function firstBlockedStatus(row) {
  return EXECUTABLE_STATUS_COLUMNS.find((key) => normalize(row[key]) === "BLOCKED") ?? "";
}

function firstNotDoneStatus(row) {
  return EXECUTABLE_STATUS_COLUMNS.find((key) => normalize(row[key]) !== "DONE") ?? "";
}

function findProjectByMention(rows, taskText) {
  const canonTask = canonical(taskText);
  for (const row of rows) {
    const key = canonical(row.project);
    if (key && canonTask.includes(key)) return row;
  }
  return null;
}

function listPortfolio(rows) {
  return rows
    .map((row) => {
      const blocked = firstBlockedStatus(row);
      const state = clean(row.row_overall_status) || "UNKNOWN";
      return `${clean(row.project)}: ${state} (${percentDone(row)})${blocked ? ` blocked=${blocked}` : ""}`;
    })
    .join("\n");
}

function addUnique(commands, command) {
  const c = clean(command);
  if (!c) return;
  if (!commands.includes(c)) commands.push(c);
}

function unblockCommands(row) {
  const commands = [];
  const blocked = firstBlockedStatus(row);
  const project = clean(row.project);
  const repoPath = clean(row.repo_path);

  if (!blocked) return commands;

  if (blocked === "build_ios_ipa_status") {
    const found = newestArtifact(repoPath, ".ipa");
    if (found) {
      addUnique(commands, `SET ${project} ipa_path ${found}`);
      addUnique(commands, `SET ${project} build_ios_ipa_status READY`);
      addUnique(commands, `RUN ${project}`);
    }
    return commands;
  }

  if (blocked === "build_android_aab_status") {
    const found = newestArtifact(repoPath, ".aab");
    if (found) {
      addUnique(commands, `SET ${project} aab_path ${found}`);
      addUnique(commands, `SET ${project} build_android_aab_status READY`);
      addUnique(commands, `RUN ${project}`);
    }
    return commands;
  }

  if (blocked === "test_ios_device_status") {
    const ipaOk = existsFile(row.ipa_path);
    const evidenceOk = clean(row.ios_test_evidence);
    if (ipaOk && evidenceOk) {
      addUnique(commands, `SET ${project} test_ios_device_status READY`);
      addUnique(commands, `RUN ${project}`);
    }
    return commands;
  }

  if (blocked === "test_android_device_status") {
    const aabOk = existsFile(row.aab_path);
    const evidenceOk = clean(row.android_test_evidence);
    if (aabOk && evidenceOk) {
      addUnique(commands, `SET ${project} test_android_device_status READY`);
      addUnique(commands, `RUN ${project}`);
    }
    return commands;
  }

  if (blocked === "asc_submission_status") {
    const ready =
      existsFile(row.ipa_path) &&
      clean(row.asc_app_id) &&
      clean(row.asc_build_number) &&
      clean(row.asc_submission_evidence);
    if (ready) {
      addUnique(commands, `SET ${project} asc_submission_status READY`);
      addUnique(commands, `RUN ${project}`);
    }
    return commands;
  }

  if (blocked === "gplay_submission_status") {
    const ready =
      existsFile(row.aab_path) &&
      clean(row.gplay_package_name) &&
      clean(row.gplay_version_code) &&
      clean(row.gplay_submission_evidence);
    if (ready) {
      addUnique(commands, `SET ${project} gplay_submission_status READY`);
      addUnique(commands, `RUN ${project}`);
    }
    return commands;
  }

  if (blocked === "ci_pipeline_status") {
    addUnique(commands, `SET ${project} ci_pipeline_status READY`);
    addUnique(commands, `RUN ${project}`);
    return commands;
  }

  if (blocked === "release_ready_status") {
    addUnique(commands, `RUN ${project}`);
    return commands;
  }

  return commands;
}

function projectSummary(row) {
  const project = clean(row.project);
  const blocked = firstBlockedStatus(row);
  const next = firstNotDoneStatus(row) || "none";
  return (
    `${project}\n` +
    `overall=${clean(row.row_overall_status) || "(blank)"} | permission=${clean(row.next_row_permission) || "(blank)"} | progress=${percentDone(row)}\n` +
    `next=${next}${blocked ? ` | blocked=${blocked}` : ""}`
  );
}

function buildResponse(rows, taskText) {
  const commands = [];
  const text = clean(taskText);
  const lower = text.toLowerCase();
  const projectRow = findProjectByMention(rows, text);
  const project = projectRow ? clean(projectRow.project) : "";
  const blocked = projectRow ? firstBlockedStatus(projectRow) : "";

  const runMatch = text.match(/\brun\s+([a-z0-9_-]+)/i);
  if (runMatch) {
    const wanted = rows.find((row) => canonical(row.project) === canonical(runMatch[1]));
    if (wanted && !firstBlockedStatus(wanted)) {
      addUnique(commands, `RUN ${clean(wanted.project)}`);
    }
  }
  const showMatch = text.match(/\bshow\s+([a-z0-9_-]+)/i);
  if (showMatch) {
    const wanted = rows.find((row) => canonical(row.project) === canonical(showMatch[1]));
    addUnique(commands, `SHOW ${clean(wanted?.project || showMatch[1])}`);
  }
  const verifyMatch = text.match(/\bverify\s+([a-z0-9_-]+)/i);
  if (verifyMatch) {
    const wanted = rows.find((row) => canonical(row.project) === canonical(verifyMatch[1]));
    addUnique(commands, `VERIFY ${clean(wanted?.project || verifyMatch[1])}`);
  }
  if (/\b(sheet|sync sheet|dashboard|grid)\b/i.test(lower)) addUnique(commands, "SHEET");
  if (/\b(next project|continue|go next)\b/i.test(lower)) addUnique(commands, "YES");
  if (/^\s*status\b/i.test(text) || /\bportfolio\b/i.test(lower)) addUnique(commands, "STATUS");

  if (projectRow && /\bunblock\b/i.test(lower)) {
    for (const command of unblockCommands(projectRow)) addUnique(commands, command);
    if (!commands.length) addUnique(commands, `SHOW ${project}`);
  }

  if (projectRow && /\brun\b/i.test(lower) && !runMatch && !blocked) {
    addUnique(commands, `RUN ${project}`);
  }

  if (projectRow && /\bnext step|what next|what should i do|what now\b/i.test(lower)) {
    addUnique(commands, `SHOW ${project}`);
  }

  if (!projectRow && /\bstatus\b/i.test(lower) && !commands.length) {
    addUnique(commands, "STATUS");
  }

  let reply = "";
  if (projectRow) {
    reply = `Tixpy task analysis:\n${projectSummary(projectRow)}`;
    if (blocked && !unblockCommands(projectRow).length) {
      reply += `\nManual unblock needed for ${blocked}.`;
    } else if (blocked) {
      reply += `\nI prepared unblock commands for ${blocked}.`;
    }
  } else if (/\bstatus|portfolio|all projects\b/i.test(lower)) {
    reply = `Tixpy portfolio snapshot:\n${listPortfolio(rows)}`;
  } else if (commands.length) {
    reply = "Tixpy understood your request and queued executable commands.";
  } else {
    reply =
      "I can help with project actions. Try: TASK run routemaster, TASK unblock dvd_valet, ASK what is next for bloom-steward, or ASK status of all projects.";
  }

  return { reply, commands };
}

function main() {
  const taskText = clean(process.env.ACTION_GRID_TASK_TEXT || process.argv.slice(2).join(" "));
  const { rows } = readCsv(CSV_PATH);

  if (!taskText) {
    process.stdout.write(
      JSON.stringify({
        reply: "TASK requires text. Example: TASK unblock dvd_valet and run it",
        commands: [],
      }),
    );
    return;
  }

  const result = buildResponse(rows, taskText);
  process.stdout.write(JSON.stringify(result));
}

main();
