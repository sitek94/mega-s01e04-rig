import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest, ReadNight } from './types.js';

type Run = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

type Job = {
  row: DigestRow;
  firstTime: number;
  lastTime: number;
  errorTime: number;
};

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) return false;
  const run = value as Record<string, unknown>;
  return typeof run.at === 'string'
    && typeof run.job === 'string' && run.job.length > 0
    && (run.status === 'ok' || run.status === 'retry' || run.status === 'fail')
    && (run.owner === null || typeof run.owner === 'string')
    && (run.error === undefined || typeof run.error === 'string');
}

export const readNight: ReadNight = (runsDir, night) => {
  // A route parameter must never become a path outside runsDir.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let source: string;
  try {
    source = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const digest: NightDigest = { night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const jobs = new Map<string, Job>();
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      digest.badLines++;
      continue;
    }
    if (!isRun(value)) {
      digest.badLines++;
      continue;
    }
    const run = value;
    const time = Date.parse(run.at);
    if (!Number.isFinite(time)) {
      digest.badLines++;
      continue;
    }
    digest.counts[run.status]++;
    let job = jobs.get(run.job);
    if (!job) {
      job = {
        row: {
          job: run.job, owner: run.owner, runs: 0, retries: 0,
          lastStatus: run.status, lastError: null, firstAt: run.at, lastAt: run.at,
        },
        firstTime: time, lastTime: time, errorTime: -Infinity,
      };
      jobs.set(run.job, job);
    }
    job.row.runs++;
    if (run.status === 'retry') job.row.retries++;
    if (time < job.firstTime) {
      job.firstTime = time;
      job.row.firstAt = run.at;
    }
    if (time >= job.lastTime) {
      job.lastTime = time;
      job.row.lastAt = run.at;
      job.row.lastStatus = run.status;
      job.row.owner = run.owner;
    }
    if (run.error !== undefined && time >= job.errorTime) {
      job.errorTime = time;
      job.row.lastError = run.error;
    }
  }
  digest.rows = [...jobs.values()].map(({ row }) => row)
    .sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return digest;
};
