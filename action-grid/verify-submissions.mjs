#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv, writeCsv } from "./csv-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = process.env.ACTION_GRID_CSV_PATH || path.join(__dirname, "projects.csv");

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function findProjectRow(rows, projectRaw) {
  const name = String(projectRaw ?? "").trim();
  if (!name) return null;
  return (
    rows.find((row) => String(row.project ?? "").trim().toLowerCase() === name.toLowerCase()) ?? null
  );
}

function getRepoProjectDir(repoPath) {
  const mobilePath = path.join(repoPath, "mobile");
  if (fs.existsSync(mobilePath) && fs.statSync(mobilePath).isDirectory()) {
    return mobilePath;
  }
  return repoPath;
}

function getExpoProjectId(projectDir) {
  const output = run("eas", ["project:info"], projectDir);
  const match = output.match(/\bID\s+([0-9a-f-]{36})\b/i);
  if (!match) {
    throw new Error("Could not resolve EAS project ID (eas project:info).");
  }
  return match[1];
}

async function querySubmissionsByPlatform(appId, platform) {
  const token = process.env.EXPO_TOKEN;
  if (!token) {
    throw new Error("EXPO_TOKEN is required for verification.");
  }

  const query = `
    query VerifySubmissions($appId: String!, $offset: Int!, $limit: Int!, $filter: SubmissionFilter!) {
      app {
        byId(appId: $appId) {
          id
          slug
          ownerAccount {
            name
          }
          submissions(offset: $offset, limit: $limit, filter: $filter) {
            id
            status
            platform
            createdAt
            updatedAt
            completedAt
            iosConfig {
              ascAppIdentifier
              appleIdUsername
            }
            androidConfig {
              applicationIdentifier
              track
              releaseStatus
              rollout
            }
            submittedBuild {
              id
              appVersion
              appBuildVersion
              completedAt
            }
            error {
              errorCode
              message
            }
          }
        }
      }
    }
  `;

  const variables = {
    appId,
    offset: 0,
    limit: 50,
    filter: { platform, status: "FINISHED" },
  };

  const response = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Expo GraphQL request failed (${response.status}).`);
  }

  const json = await response.json();
  if (Array.isArray(json?.errors) && json.errors.length) {
    throw new Error(`Expo GraphQL error: ${json.errors[0]?.message ?? "unknown"}`);
  }

  const app = json?.data?.app?.byId;
  const submissions = Array.isArray(app?.submissions) ? app.submissions : [];
  return {
    owner: String(app?.ownerAccount?.name ?? "").trim(),
    slug: String(app?.slug ?? "").trim(),
    submissions,
  };
}

function pickLatestSubmission(submissions) {
  if (!submissions.length) return null;
  return [...submissions].sort((a, b) => {
    const at = Date.parse(String(a?.completedAt ?? a?.updatedAt ?? a?.createdAt ?? 0));
    const bt = Date.parse(String(b?.completedAt ?? b?.updatedAt ?? b?.createdAt ?? 0));
    return bt - at;
  })[0];
}

function submissionPortalUrl(owner, slug, submissionId) {
  if (!owner || !slug || !submissionId) return "";
  return `https://expo.dev/accounts/${owner}/projects/${slug}/submissions/${submissionId}`;
}

function verifyAndUpdateRow(row, iosSubmission, androidSubmission, owner, slug) {
  const now = nowIso();
  let changed = false;

  if (iosSubmission) {
    row.asc_submission_status = "DONE";
    row.asc_submission_completed_at = iosSubmission.completedAt || now;
    row.asc_app_id = String(iosSubmission?.iosConfig?.ascAppIdentifier ?? row.asc_app_id ?? "").trim();
    row.asc_build_number = String(
      iosSubmission?.submittedBuild?.appBuildVersion ?? row.asc_build_number ?? "",
    ).trim();
    row.asc_submission_evidence = [
      "source=expo_graphql",
      `submission_id=${iosSubmission.id}`,
      `completed_at=${row.asc_submission_completed_at}`,
      `url=${submissionPortalUrl(owner, slug, iosSubmission.id)}`,
    ].join("; ");
    changed = true;
  } else if (normalize(row.asc_submission_status) === "DONE") {
    row.asc_submission_status = "READY";
    row.asc_submission_completed_at = "";
    row.asc_submission_evidence = "";
    changed = true;
  }

  if (androidSubmission) {
    const packageName = String(
      androidSubmission?.androidConfig?.applicationIdentifier ?? row.gplay_package_name ?? "",
    ).trim();
    const versionCode = String(
      androidSubmission?.submittedBuild?.appBuildVersion ?? row.gplay_version_code ?? "",
    ).trim();

    row.gplay_package_name = packageName;
    row.gplay_version_code = versionCode;
    row.gplay_submission_status = "DONE";
    row.gplay_submission_completed_at = androidSubmission.completedAt || now;
    row.gplay_submission_evidence = [
      "source=expo_graphql",
      `submission_id=${androidSubmission.id}`,
      `completed_at=${row.gplay_submission_completed_at}`,
      `track=${String(androidSubmission?.androidConfig?.track ?? "").trim() || "unknown"}`,
      `url=${submissionPortalUrl(owner, slug, androidSubmission.id)}`,
    ].join("; ");
    changed = true;
  } else if (normalize(row.gplay_submission_status) === "DONE") {
    row.gplay_submission_status = "READY";
    row.gplay_submission_completed_at = "";
    row.gplay_submission_evidence = "";
    changed = true;
  }

  const statuses = [
    "build_ios_ipa_status",
    "build_android_aab_status",
    "asc_submission_status",
    "gplay_submission_status",
    "ci_pipeline_status",
    "release_ready_status",
  ];
  const allDone = statuses.every((key) => normalize(row[key]) === "DONE");
  if (!allDone && normalize(row.release_ready_status) === "DONE") {
    row.release_ready_status = "READY";
    row.release_ready_completed_at = "";
    changed = true;
  }
  if (!allDone && normalize(row.row_overall_status) === "DONE") {
    row.row_overall_status = "READY";
    changed = true;
  }

  return changed;
}

async function main() {
  const projectInput = process.argv.slice(2).join(" ").trim() || String(process.env.ACTION_GRID_PROJECT ?? "").trim();
  if (!projectInput) {
    console.error("Project name is required. Usage: node action-grid/verify-submissions.mjs <project>");
    process.exit(1);
  }

  const { header, rows } = readCsv(CSV_PATH);
  const row = findProjectRow(rows, projectInput);
  if (!row) {
    console.error(`Project not found: ${projectInput}`);
    process.exit(1);
  }

  const repoPath = String(row.repo_path ?? "").trim();
  if (!repoPath || !fs.existsSync(repoPath)) {
    console.error(`Invalid repo_path for ${row.project}: ${repoPath || "(empty)"}`);
    process.exit(1);
  }

  const projectDir = getRepoProjectDir(repoPath);
  const appId = getExpoProjectId(projectDir);

  const iosData = await querySubmissionsByPlatform(appId, "IOS");
  const androidData = await querySubmissionsByPlatform(appId, "ANDROID");
  const iosSubmission = pickLatestSubmission(iosData.submissions);
  const androidSubmission = pickLatestSubmission(androidData.submissions);
  const owner = iosData.owner || androidData.owner;
  const slug = iosData.slug || androidData.slug;

  const changed = verifyAndUpdateRow(row, iosSubmission, androidSubmission, owner, slug);
  if (changed) {
    writeCsv(CSV_PATH, header, rows);
  }

  const iosSummary = iosSubmission
    ? `ios=FINISHED id=${iosSubmission.id} completed=${iosSubmission.completedAt || "-"} asc_app_id=${iosSubmission?.iosConfig?.ascAppIdentifier || "-"} build=${iosSubmission?.submittedBuild?.appBuildVersion || "-"}`
    : "ios=NO_FINISHED_SUBMISSION";

  const androidSummary = androidSubmission
    ? `android=FINISHED id=${androidSubmission.id} completed=${androidSubmission.completedAt || "-"} package=${androidSubmission?.androidConfig?.applicationIdentifier || "-"} version_code=${androidSubmission?.submittedBuild?.appBuildVersion || "-"}`
    : "android=NO_FINISHED_SUBMISSION";

  console.log(`VERIFY ${row.project}: ${iosSummary}; ${androidSummary}`);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
