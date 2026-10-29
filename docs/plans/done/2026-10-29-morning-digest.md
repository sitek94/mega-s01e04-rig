---
plan: morning-digest
status: done
owner: rook
opened: 2026-10-29
closed: 2026-10-29
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Issues

| # | Issue | Blocked by | Worker | Closed |
|---|-------|-----------|--------|--------|
| [1](https://github.com/sitek94/mega-s01e04-rig/issues/1) | Run log reader | — | OMP · openai-codex/gpt-6.1-sol · effort not exposed | 2026-10-29 |
| [2](https://github.com/sitek94/mega-s01e04-rig/issues/2) | Digest HTML page | #1 shared types | OMP · cursor/gpt-5.4-mini · low | 2026-10-29 |
| [3](https://github.com/sitek94/mega-s01e04-rig/issues/3) | Digest JSON endpoint | #1 shared types; #2 for parity | OMP · cursor/gpt-5.4-mini · low | 2026-10-29 |
| [4](https://github.com/sitek94/mega-s01e04-rig/issues/4) | Board digest links | #1 shared types; #2 for navigation | OMP · cursor/gpt-5.4-mini · low | 2026-10-29 |
| [5](https://github.com/sitek94/mega-s01e04-rig/issues/5) | Digest route tests | #1 shared types; #2 and #3 to finish | OMP · cursor/gpt-5.4-mini · low; parent strengthened assertions | 2026-10-29 |
| [6](https://github.com/sitek94/mega-s01e04-rig/issues/6) | Publish review preview | #1–#5; publication approval | OMP · openai-codex/gpt-6.1-sol · effort not exposed | 2026-10-29 |
| [7](https://github.com/sitek94/mega-s01e04-rig/issues/7) | Remove marker and finish plan | Reviewer acknowledgement; replacement approval | OMP · openai-codex/gpt-6.1-sol · effort not exposed | 2026-10-29 |

Sections 2a–2d started in isolated workers after shared-types commit `c7e07c4`.
The course required explicit reviewer acknowledgement before closing #6; accepting the
link handoff alone was not sufficient. A premature closure was corrected by reopening it.
After acknowledgement and separate human approval, the same
[public preview](https://sitek94.github.io/mega-s01e04-rig/) was regenerated with
`LANE_MARKER` unset. Its banner reads "no marker set"; the sample-data HTML is otherwise
unchanged. Both temporary deployment artifacts were deleted after publication.
