# Sentry Investigation

This directory exists to help you investigate current bridge errors from
Cloudflare Analytics Engine and compare them against Sentry. It intentionally
avoids checked-in generated reports or static classification code, because new
error tuples can appear at any time.

The workflow is:

1. export a fresh CSV from AE
2. inspect the highest-volume tuples
3. decide whether each tuple is a root exception, a synthetic rollup, or an
   intentionally filtered noise case
4. inspect the capture and filtering code before changing instrumentation

## Files

- `errors-export.sql` is the live AE query used to export the current error
  tuples.
- `scripts/export-errors-csv.ts` runs that query against AE and prints CSV to
  stdout.
- `capture-policy.md` explains how to reason about whether an AE error should
  appear in Sentry and where to inspect the code.

## Generate A Fresh CSV

Run this from the repo root:

```sh
CLOUDFLARE_API_TOKEN=... moon run bridge-ui:sentry-errors-csv > bridge-errors.csv
```

If you want a different time window or output path, call the script directly:

```sh
CLOUDFLARE_API_TOKEN=... \
AE_DATASET=bridge_metrics \
node --experimental-strip-types \
./apps/bridge-ui/observability/bridge-metrics/sentry/scripts/export-errors-csv.ts \
--window 7d \
--output ./bridge-errors.csv
```

Notes:

- `CLOUDFLARE_API_TOKEN` must have `Account Analytics Read`.
- `CLOUDFLARE_ACCOUNT_ID` defaults to `a12d2915bc16ee8550f19399839623f7`.
- `AE_DATASET` defaults to `bridge_metrics`.
- If you do not pass `--output`, the CSV is printed to stdout.
- The export is always live data from AE. There is no checked-in `errors.csv`.

## Investigate New Errors

1. Generate a fresh CSV from AE for the time window you care about.
2. Start with the highest-occurrence tuples and decide whether each one is:
   - a root exception that should appear in Sentry
   - a synthetic lifecycle rollup that should stay AE-only
   - a filtered noise case such as `QuietError` or wallet rejection
3. Inspect the capture path in:
   - `apps/bridge-ui/machines/debug.ts`
   - `apps/bridge-ui/app/telemetry/bridgeErrors.ts`
   - `apps/bridge-ui/sentry.client.config.ts`
4. Search Sentry for the normalized message or bridge tags:
   - `bridge_category`
   - `bridge_action`
   - `bridge_source`
   - `bridge_destination`
   - `bridge_direction`
5. If a root exception is missing from Sentry, fix the capture path or the
   filtering rule. Do not add a one-off classification script for that single
   tuple.
