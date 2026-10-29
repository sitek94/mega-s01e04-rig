import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

type NightLine = {
  at: string;
  job: string;
  status: 'ok' | 'retry' | 'fail';
  owner: string | null;
  error?: string;
};

const configBase = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function makeRunsDir(nights: Record<string, Array<NightLine | string>>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tempDirs.push(runsDir);
  for (const [night, lines] of Object.entries(nights)) {
    writeFileSync(
      join(runsDir, `${night}.jsonl`),
      lines
        .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
        .join('\n'),
    );
  }
  return runsDir;
}

async function htmlFor(runsDir: string, night: string) {
  const res = await createApp({ ...configBase, runsDir }).request(`/digest/${night}`);
  return { res, html: await res.text() };
}

async function jsonFor(runsDir: string, night: string) {
  const res = await createApp({ ...configBase, runsDir }).request(`/api/digest/${night}`);
  return { res, body: await res.json() as NightDigest };
}

function tableRows(html: string) {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((cell) => ({
      value: cell[2].replace(/<[^>]*>/g, '').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
      warning: /class="[^"]*\bwarn\b/.test(cell[1]),
    })))
    .filter((row) => row.length > 0);
}

describe('digest routes', () => {
  it('renders and returns the same sorted rows in html and json', async () => {
    const runsDir = makeRunsDir({
      '2026-10-28': [
        { at: '2026-10-28T01:00:00+02:00', job: 'zeta <script>', status: 'retry', owner: null, error: 'bad <tag>' },
        { at: '2026-10-28T00:01:00+02:00', job: 'alpha', status: 'retry', owner: 'opal', error: 'warn' },
        { at: '2026-10-28T00:02:00+02:00', job: 'alpha', status: 'retry', owner: 'opal', error: 'warn-2' },
        { at: '2026-10-28T00:03:00+02:00', job: 'alpha', status: 'ok', owner: 'opal' },
        { at: '2026-10-28T00:04:00+02:00', job: 'beta', status: 'retry', owner: 'sam', error: 'first' },
        { at: '2026-10-28T00:05:00+02:00', job: 'beta', status: 'retry', owner: 'sam', error: 'second' },
        { at: '2026-10-28T00:06:00+02:00', job: 'beta', status: 'fail', owner: 'sam', error: 'third' },
        { at: '2026-10-28T00:07:00+02:00', job: 'gamma', status: 'retry', owner: 'lee', error: 'one' },
        { at: '2026-10-28T00:08:00+02:00', job: 'gamma', status: 'retry', owner: 'lee', error: 'two' },
        { at: '2026-10-28T00:09:00+02:00', job: 'gamma', status: 'retry', owner: 'lee', error: 'three' },
      ],
    });

    const { res: htmlRes, html } = await htmlFor(runsDir, '2026-10-28');
    const { res: jsonRes, body } = await jsonFor(runsDir, '2026-10-28');

    expect(htmlRes.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    expect(body).toEqual({
      night: '2026-10-28',
      badLines: 0,
      counts: { ok: 1, retry: 8, fail: 1 },
      rows: [
        {
          job: 'alpha',
          owner: 'opal',
          runs: 3,
          retries: 2,
          lastStatus: 'ok',
          lastError: 'warn-2',
          firstAt: '2026-10-28T00:01:00+02:00',
          lastAt: '2026-10-28T00:03:00+02:00',
        },
        {
          job: 'beta',
          owner: 'sam',
          runs: 3,
          retries: 2,
          lastStatus: 'fail',
          lastError: 'third',
          firstAt: '2026-10-28T00:04:00+02:00',
          lastAt: '2026-10-28T00:06:00+02:00',
        },
        {
          job: 'gamma',
          owner: 'lee',
          runs: 3,
          retries: 3,
          lastStatus: 'retry',
          lastError: 'three',
          firstAt: '2026-10-28T00:07:00+02:00',
          lastAt: '2026-10-28T00:09:00+02:00',
        },
        {
          job: 'zeta <script>',
          owner: null,
          runs: 1,
          retries: 1,
          lastStatus: 'retry',
          lastError: 'bad <tag>',
          firstAt: '2026-10-28T01:00:00+02:00',
          lastAt: '2026-10-28T01:00:00+02:00',
        },
      ],
    });
    expect(html).toContain('zeta &lt;script&gt;');
    expect(html).toContain('bad &lt;tag&gt;');
    expect(html).not.toContain('<script>');
    const rendered = tableRows(html);
    expect(rendered.map((row) => row.map((cell) => cell.value))).toEqual(
      body.rows.map((row) => [
        row.job, row.owner ?? '—', String(row.runs), String(row.retries),
        row.lastStatus, row.lastError ?? '—', row.firstAt, row.lastAt,
      ]),
    );
    expect(rendered.map((row) => [row[0].value, row[3].warning, row[4].warning])).toEqual([
      ['alpha', false, false], ['beta', false, true], ['gamma', true, false],
      ['zeta <script>', false, false],
    ]);
  });

  it('returns 404 for a missing night', async () => {
    const runsDir = makeRunsDir({});
    const { res: htmlRes } = await htmlFor(runsDir, '2026-10-28');
    const { res: jsonRes } = await jsonFor(runsDir, '2026-10-28');
    expect(htmlRes.status).toBe(404);
    expect(jsonRes.status).toBe(404);
  });

  it('renders an empty night', async () => {
    const runsDir = makeRunsDir({ '2026-10-28': [] });
    const { res: htmlRes, html } = await htmlFor(runsDir, '2026-10-28');
    const { res: jsonRes, body } = await jsonFor(runsDir, '2026-10-28');
    expect(htmlRes.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(body).toEqual({
      night: '2026-10-28',
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
      rows: [],
    });
  });

  it('counts malformed lines and keeps rendering', async () => {
    const runsDir = makeRunsDir({
      '2026-10-28': [
        '{"at":"2026-10-28T00:00:00+02:00","job":"good","status":"ok","owner":"one"}',
        '{not json',
      ],
    });
    const { res: htmlRes, html } = await htmlFor(runsDir, '2026-10-28');
    const { res: jsonRes, body } = await jsonFor(runsDir, '2026-10-28');
    expect(htmlRes.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    expect(body).toEqual({
      night: '2026-10-28',
      badLines: 1,
      counts: { ok: 1, retry: 0, fail: 0 },
      rows: [
        {
          job: 'good',
          owner: 'one',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T00:00:00+02:00',
          lastAt: '2026-10-28T00:00:00+02:00',
        },
      ],
    });
    expect(html).toContain('good');
  });

  it('links every night and counts records rather than final job statuses', async () => {
    const runsDir = makeRunsDir({
      '2026-10-27': [
        { at: '2026-10-27T23:00:00+01:00', job: 'job', status: 'ok', owner: null },
      ],
      '2026-10-28': [
        { at: '2026-10-28T23:00:00+01:00', job: 'job', status: 'retry', owner: null },
        { at: '2026-10-28T23:01:00+01:00', job: 'job', status: 'fail', owner: null },
        { at: '2026-10-28T23:02:00+01:00', job: 'job', status: 'ok', owner: null },
        '{broken',
      ],
    });
    const response = await createApp({ ...configBase, runsDir }).request('/');
    expect(response.status).toBe(200);
    const html = await response.text();
    const nights = [...html.matchAll(/<li>\s*<a href="([^"]+)">[^<]*<\/a>([\s\S]*?)<\/li>/g)];
    expect(nights.map((night) => night[1])).toEqual(['/digest/2026-10-28', '/digest/2026-10-27']);
    expect(nights.map((night) => night[2].match(/\d+/g))).toEqual([['1', '1', '1'], ['1', '0', '0']]);
  });
});
