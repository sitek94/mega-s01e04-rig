import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('night reader', () => {
  let runsDir: string;
  beforeEach(() => { runsDir = mkdtempSync(join(tmpdir(), 'rig-reader-')); });
  afterEach(() => { rmSync(runsDir, { recursive: true, force: true }); });

  it('aggregates the supplied night without losing the null-owner job or damaged line', () => {
    const night = readNight('runs', '2026-10-28')!;
    expect(night.badLines).toBe(1);
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(night.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(night.rows[0]).toMatchObject({ owner: null, runs: 1, retries: 0, lastStatus: 'ok' });
    expect(night.rows[1]).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3,
      lastStatus: 'ok', lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night.rows[2]).toMatchObject({ runs: 8, retries: 1, lastError: 'lock held' });
    expect(night.rows[3]).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('distinguishes an empty existing file from a missing night and rejects path traversal', () => {
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    expect(readNight(runsDir, '2026-10-28')).toEqual({
      night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
    expect(readNight(runsDir, '2026-10-27')).toBeNull();
    expect(readNight(runsDir, '../2026-10-28')).toBeNull();
  });

  it('counts malformed records while retaining valid records from the same file', () => {
    const valid = { at: '2026-10-28T23:00:00+02:00', job: 'job', owner: null, status: 'ok' };
    const lines = [null, [], {}, { ...valid, status: 'unknown' }, { ...valid, at: 'bad time' },
      { ...valid, owner: 5 }, { ...valid, error: {} }, valid];
    writeFileSync(join(runsDir, '2026-10-28.jsonl'),
      lines.map((line) => JSON.stringify(line)).join('\r\n') + '\r\n{broken\r\n\r\n');
    const night = readNight(runsDir, '2026-10-28')!;
    expect(night.badLines).toBe(8);
    expect(night.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
    expect(night.rows).toEqual([{
      job: 'job', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
      firstAt: valid.at, lastAt: valid.at,
    }]);
  });

  it('uses actual time across offsets and unordered records without replacing source timestamps', () => {
    const runs = [
      { at: '2026-10-29T01:00:00+01:00', status: 'ok', owner: null },
      { at: '2026-10-29T01:30:00+02:00', status: 'retry', owner: 'rook', error: 'recent error' },
      { at: '2026-10-28T22:00:00+00:00', status: 'fail', owner: 'earlier', error: 'old error' },
    ];
    writeFileSync(join(runsDir, '2026-10-28.jsonl'),
      runs.map((run) => JSON.stringify({ job: 'job', ...run })).join('\n'));
    expect(readNight(runsDir, '2026-10-28')!.rows).toEqual([{
      job: 'job', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'recent error',
      firstAt: runs[2].at, lastAt: runs[0].at,
    }]);
  });
});
