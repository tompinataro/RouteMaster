import { createApp } from './app';
import { startReportCron } from './cron/reports';
import { ensureManagedPasswordColumn } from './db/ensure';
import {
  HOST,
  IS_TEST,
  PORT,
} from './config';

ensureManagedPasswordColumn().catch(() => {});

export const app = createApp();

if (!IS_TEST) {
  startReportCron();
}

const port = PORT;
const host = HOST;
if (!IS_TEST) {
  app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });
}
