import cron from 'node-cron';
import { runIngest } from './ingest';

const EVERY_20_MIN = '*/20 * * * *';

declare global {
  // survives dev HMR reloads so we never double-schedule

  var __briefSchedulerStarted: boolean | undefined;
}

/**
 * Local scheduler (node-cron). On Vercel this is a no-op — vercel.json cron
 * hits /api/cron/ingest instead. Also fires one ingest shortly after boot so
 * a fresh clone is never empty (spec §7).
 */
export function startScheduler(): void {
  if (process.env.VERCEL) return;
  if (globalThis.__briefSchedulerStarted) return;
  globalThis.__briefSchedulerStarted = true;

  cron.schedule(EVERY_20_MIN, () => {
    runIngest().catch((err) =>
      console.log(JSON.stringify({ event: 'scheduled_ingest_failed', error: String(err).slice(0, 200) }))
    );
  });

  setTimeout(() => {
    runIngest().catch((err) =>
      console.log(JSON.stringify({ event: 'boot_ingest_failed', error: String(err).slice(0, 200) }))
    );
  }, 3_000);

  console.log(JSON.stringify({ event: 'scheduler_started', schedule: EVERY_20_MIN }));
}
