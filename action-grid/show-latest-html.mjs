#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const SHEET_SYNC_PATH = path.join(__dirname, "sheet-sync.mjs");
const CANOPI_HTML_PATH = "/Users/tompinataro/My Projects/Canopi/tracker-view.html";
const LOCAL_HTML_PATH = path.join(__dirname, "tracker-view.html");

function runSheetSync() {
  const result = spawnSync(process.execPath, [SHEET_SYNC_PATH], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveTarget() {
  if (fs.existsSync(CANOPI_HTML_PATH)) return CANOPI_HTML_PATH;
  return LOCAL_HTML_PATH;
}

function openTarget(target) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const args = process.platform === "win32" ? [target] : [target];
  const result = spawnSync(opener, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.log(`Latest dashboard: ${target}`);
    process.exit(result.status ?? 1);
  }
}

runSheetSync();
const target = resolveTarget();
console.log(`Opening latest dashboard: ${target}`);
openTarget(target);
