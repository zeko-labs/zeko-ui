# Actions API

This service provides an API to retrieve actions in an efficient way.

- fetch deposit/withdrawal based on aux
- fetch all actions with range, where after is required

## Standalone Node.js mode

`src/standalone.ts` runs the same Worker `fetch` handler behind a Node.js HTTP server, so the API can be deployed without the Cloudflare Worker runtime or Hyperdrive. The Worker entry point and deployment (`wrangler`) are unchanged.

Environment:

- `DATABASE_URL` (required): direct PostgreSQL connection string; used because no Hyperdrive binding exists in this mode.
- `PORT` (optional, default `9100`) and `HOST` (optional, default `0.0.0.0`).
- `ENVIRONMENT` (optional): reported by `/health` and used for CORS selection, as in the Worker.

Run it with `moon run actions-api:start-standalone` (builds `dist/standalone.js` first; reads the project `.env` file). The `docker.io/zekolabs/zeko-actions-api` image built from `nix/docker.nix` at the repository root starts this entry.
