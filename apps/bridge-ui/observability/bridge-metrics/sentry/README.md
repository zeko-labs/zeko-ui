# Sentry Audit

This directory tracks how Bridge UI Analytics Engine error labels should map to
Sentry.

## Files

- `classify-ae-error.ts` contains the classification rules for the current CSV.
- `scripts/generate-audit.ts` reads the CSV, classifies each unique tuple, and
  regenerates the checked-in outputs.
- `bridge-ae-errors.audit.json` is the structured audit output.
- `bridge-ae-errors.audit.md` is the human-readable audit report.
- `capture-policy.md` documents the intended Sentry capture strategy.
