# Action Grid

`projects.csv` now supports end-of-row Telegram approvals:

- `row_overall_status`: `READY` | `RUNNING` | `DONE` | `BLOCKED`
- `next_row_permission`: `PAUSE` | `GO`

Default behavior: all rows start with `next_row_permission=PAUSE`.

## Runner

Run:

```bash
npm run action-grid:runner
```

Rules implemented:

- picks first row where `row_overall_status=READY` and `next_row_permission=GO`
- executes ONLY executable `*_status` lifecycle columns left-to-right:
  - `build_ios_ipa_status`
  - `build_android_aab_status`
  - `asc_submission_status`
  - `gplay_submission_status`
  - `ci_pipeline_status`
  - `release_ready_status`
- never executes metadata columns such as:
  - `build_ios_ipa_completed_at`, `ipa_path`
  - `build_android_aab_completed_at`, `aab_path`
  - `asc_submission_completed_at`, `asc_app_id`, `asc_build_number`
  - `gplay_submission_completed_at`, `gplay_package_name`, `gplay_version_code`
  - `ci_pipeline_completed_at`, `release_ready_completed_at`
- when a status task reaches `DONE`, runner stamps matching `*_completed_at` if present
- metadata fields are expected task outputs (written by task executors), not runnable tasks
- if any task is `BLOCKED`, sets `row_overall_status=BLOCKED`, sends Telegram summary, and stops
- if all lifecycle status columns are `DONE`, sets `row_overall_status=DONE`, sends Telegram message:
  - `Reply YES to run next project, NO to pause.`
- stops after the end-of-row Telegram message (no auto-advance)

Runner expects an executor command via:

- `ACTION_GRID_EXECUTOR` (required for actual task execution)

Per-task env vars passed to the executor:

- `ACTION_GRID_PROJECT`
- `ACTION_GRID_REPO_PATH`
- `ACTION_GRID_STATUS_COLUMN`
- `ACTION_GRID_CSV_PATH`

### When A Task Is BLOCKED

`BLOCKED` now means validation failed and needs an explicit fix before progress can continue.

Common unblock actions:

- `build_ios_ipa_status` blocked:
  - build an `.ipa` and set `ipa_path` to the absolute file path
- `build_android_aab_status` blocked:
  - build an `.aab` and set `aab_path`
- `asc_submission_status` blocked:
  - ensure `ipa_path` exists, then fill `asc_app_id`, `asc_build_number`, and `asc_submission_evidence`
- `gplay_submission_status` blocked:
  - ensure `aab_path` exists, then fill `gplay_package_name`, `gplay_version_code`, and `gplay_submission_evidence`
- `ci_pipeline_status` blocked:
  - ensure repo has `.github/workflows` and `repo_path` points to the correct root
- `release_ready_status` blocked:
  - complete all prior status tasks (`DONE`) first

After fixing, set the blocked status back to `READY` and run again (`RUN <project>` in Telegram).

## Telegram Listener

Run:

```bash
npm run action-grid:tg-listener
```

Rules implemented:

- on `YES`: sets the next project's `next_row_permission=GO` (next row after last `row_overall_status=DONE`) and replies:
  - `OK — starting next project`
- on `NO`: no row change; replies:
  - `Paused`

Listener stores Telegram offset in:

- `action-grid/.telegram-offset`

## Telegram env vars

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (used by runner; listener replies to incoming chat directly)

## Daemon

The daemon is now the primary operator.

Run:

```bash
npm run action-grid:up
```

It owns both loops:

- single Telegram long-poller (`getUpdates`)
- periodic runner trigger every 30s (only when a row is `READY+GO`)
- immediate runner invocation on Telegram `YES`/`RUN <project>`
- row snapshot query on Telegram `SHOW <project>`
- all-project status summary on Telegram `STATUS`
- quick command/field guide on Telegram `HELP`

Control:

```bash
npm run action-grid:status
npm run action-grid:logs
npm run action-grid:down
```

Log file:

- `action-grid/daemon.log` (append-only)

## How Tom Runs This While Traveling

1. Set env vars once in shell profile or exported session:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `ACTION_GRID_EXECUTOR`
2. Start daemon:
   - `npm run action-grid:up`
3. Check health quickly:
   - `npm run action-grid:status`
   - `npm run action-grid:logs`
4. Approve from Telegram:
   - reply `YES` (or `YES 555`):
     - bot ACK: `✅ YES received — starting next project now…`
     - daemon promotes next eligible row to `READY+GO` (skips `DONE`/`BLOCKED`; skips rows already `PAUSE` unless explicitly selected)
     - daemon runs `npm run -s action-grid:runner` once immediately and posts success/failure note
   - reply `RUN <project>` (example: `RUN routemaster`):
     - sets that row to `READY+GO` unless it is `BLOCKED`
     - runs runner once immediately and posts success/failure note
   - reply `SET <project> <field> <value>` (examples):
     - `SET routemaster ipa_path /Users/tom/.../build.ipa`
     - `SET routemaster asc_app_id 1234567890`
     - `SET routemaster asc_build_number 42`
     - `SET routemaster asc_submission_evidence https://appstoreconnect.apple.com/...`
     - `SET routemaster gplay_submission_evidence https://play.google.com/console/...`
     - `SET routemaster asc_submission_status READY`
     - bot applies update to `projects.csv` and replies with confirmation
   - reply `SHOW <project>` (example: `SHOW pool-steward`):
     - bot replies with current row snapshot:
       - `row_overall_status`, `next_row_permission`
       - all `*_status` values
       - populated `*_completed_at` timestamps
       - key metadata fields (`repo_path`, artifact paths, IDs, submission evidence, etc.)
   - reply `STATUS`:
     - bot replies with all project rows and lifecycle progress in one summary
   - reply `HELP` (or `?`):
     - bot replies with heading definitions and command examples
   - reply `NO`:
     - bot ACK: `⏸️ Paused — no new project started.`
     - no row changes
5. Stop when needed:
   - `npm run action-grid:down`
