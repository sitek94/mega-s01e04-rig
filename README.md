# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board,
and a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

## Morning digest

- `/` links every night on disk to its digest, newest first, with ok / retry / fail
  counts of log records (not final job states).
- `/digest/2026-10-28` renders the night as one self-contained HTML page.
- `/api/digest/2026-10-28` returns the same sorted rows, `badLines`, and record `counts`.
  Each row includes `job`, nullable `owner`, total `runs`, `retries`, `lastStatus`,
  nullable `lastError`, `firstAt`, and `lastAt`.

Malformed records are counted and skipped. Missing nights return 404; an existing empty
file renders "nothing ran". Missing owners/errors render as `—`. Times retain their
original offsets; final state and first/last times follow chronological order. The last
recorded error remains visible after recovery. At least three retries and any final
failure are marked. Run logs are read-only.

The service binds only to `127.0.0.1`; `PORT` defaults to 8787. `pnpm test` exercises
reader boundaries and HTML/JSON routes with isolated fixtures; `pnpm typecheck` checks types.

For a review, export the running page with a command such as:

```sh
curl --fail http://127.0.0.1:8787/digest/2026-10-28 -o ../preview.html
```

Keep previews and `.env` out of Git. Publish only after approval, wait for review, then
restart without `LANE_MARKER`, export again and replace the same public URL after a second
approval. The marker-free banner reads "no marker set"; do not merely hide the marker.
The active [plan](plan.md) moves to `docs/plans/done/` with its issue links only after cleanup.
