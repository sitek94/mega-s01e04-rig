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
The completed [morning digest plan](docs/plans/done/2026-10-29-morning-digest.md) records its
issue list, review prerequisite, and verified cleanup.

## GitHub Pages review copy

The [preview workflow](.github/workflows/preview.yml) exports the running Hono route to
one HTML file in the runner's temporary directory, then deploys through GitHub's Pages
artifact API. This is not a Vite build or an SPA: the public site has no server or API.
Generated HTML is never committed to `main` or a `gh-pages` branch.

The public copy is at <https://sitek94.github.io/mega-s01e04-rig/>. The workflow is
manual-only and restricted to `main`; code pushes do not republish the page.
The repository secret `LANE_MARKER` supplies the first review banner. Dispatch with
`include_marker=true` only after publication approval. After review and separate removal
approval, dispatch with `include_marker=false` to unset the marker and replace that same URL.

Sending the preview is only a handoff. Keep review issue #6 open, the preview stable, and
the marker present until the reviewer acknowledges looking at it. Do not close the issue
when the course merely accepts the handoff. Cleanup issue #7 waits for that acknowledgement
and separate human approval.

After each deployment, delete that run's temporary `github-pages` artifact; its fallback
retention is one day if interrupted. Verify the public page after publication or replacement.
The workflow, secret and Pages configuration do not authorize course submission.
