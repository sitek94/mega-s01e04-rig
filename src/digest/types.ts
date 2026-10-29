export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: Record<DigestStatus, number>;
};

// Missing nights return null; an existing empty night has no rows and zero counts.
// Rows are sorted by job. Times retain their source offsets; lastError is the
// most recent recorded error, even when a later successful run has no error.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
