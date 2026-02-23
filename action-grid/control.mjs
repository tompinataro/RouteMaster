#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PID_PATH = path.join(__dirname, "daemon.pid");
const LOG_PATH = path.join(__dirname, "daemon.log");
const DAEMON_PATH = path.join(__dirname, "daemon.mjs");

function readPid() {
  try {
    const raw = fs.readFileSync(PID_PATH, "utf8").trim();
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function isRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function up() {
  const existing = readPid();
  if (existing && isRunning(existing)) {
    console.log(`action-grid daemon is already running (pid ${existing})`);
    return;
  }

  const child = spawn(process.execPath, [DAEMON_PATH], {
    cwd: __dirname,
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  await new Promise((resolve) => setTimeout(resolve, 500));
  const pid = readPid();
  if (pid && isRunning(pid)) {
    console.log(`action-grid daemon started (pid ${pid})`);
    return;
  }
  console.log("action-grid daemon failed to start; check action-grid/daemon.log");
}

async function down() {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    console.log("action-grid daemon is not running");
    fs.rmSync(PID_PATH, { force: true });
    return;
  }

  process.kill(pid, "SIGTERM");

  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!isRunning(pid)) {
      console.log(`action-grid daemon stopped (pid ${pid})`);
      fs.rmSync(PID_PATH, { force: true });
      return;
    }
  }

  process.kill(pid, "SIGKILL");
  console.log(`action-grid daemon force-killed (pid ${pid})`);
  fs.rmSync(PID_PATH, { force: true });
}

function status() {
  const pid = readPid();
  if (pid && isRunning(pid)) {
    console.log(`action-grid daemon running (pid ${pid})`);
    return;
  }
  console.log("action-grid daemon not running");
}

function logs() {
  if (!fs.existsSync(LOG_PATH)) {
    console.log("action-grid/daemon.log does not exist yet");
    return;
  }

  const result = spawnSync("tail", ["-n", "200", LOG_PATH], { stdio: "inherit" });
  if (result.error) {
    const text = fs.readFileSync(LOG_PATH, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    const last = lines.slice(-200);
    for (const line of last) console.log(line);
  }
}

async function main() {
  const cmd = (process.argv[2] ?? "").trim().toLowerCase();
  if (cmd === "up") return up();
  if (cmd === "down") return down();
  if (cmd === "status") return status();
  if (cmd === "logs") return logs();

  console.log("usage: node action-grid/control.mjs <up|down|status|logs>");
  process.exitCode = 1;
}

main();
