#!/usr/bin/env bash
set -u

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../../.." && pwd)
WORKSPACE_DIR="$ROOT_DIR/apps/bridge-ui/observability/bridge-metrics"
SQL_DIR="$WORKSPACE_DIR/analytics-engine/sql"
QUERY_SCRIPT="$WORKSPACE_DIR/analytics-engine/scripts/run-query.ts"
REPORT_SCRIPT="$WORKSPACE_DIR/analytics-engine/scripts/render-report.ts"

MODE="live"
WINDOW=""
OUTPUT=""
RAW_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      MODE="render"
      shift
      ;;
    --window)
      WINDOW="${2:-}"
      shift 2
      ;;
    --window=*)
      WINDOW="${1#*=}"
      shift
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    --output=*)
      OUTPUT="${1#*=}"
      shift
      ;;
    --raw-dir)
      RAW_DIR="${2:-}"
      shift 2
      ;;
    --raw-dir=*)
      RAW_DIR="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$RAW_DIR" ]]; then
  RAW_DIR=$(mktemp -d "${TMPDIR:-/tmp}/bridge-metrics-report.XXXXXX")
fi

mkdir -p "$RAW_DIR"

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-a12d2915bc16ee8550f19399839623f7}"
export AE_DATASET="${AE_DATASET:-bridge_metrics}"

if [[ "$MODE" == "live" ]]; then
  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "CLOUDFLARE_API_TOKEN is required for live AE queries." >&2
    exit 1
  fi

  if pnpm --dir "$ROOT_DIR/apps/bridge-ui" exec wrangler whoami --account "$CLOUDFLARE_ACCOUNT_ID" >/dev/null 2>&1; then
    :
  else
    echo "Warning: wrangler whoami sanity check did not succeed for account $CLOUDFLARE_ACCOUNT_ID." >&2
  fi
fi

mapfile -t SQL_FILES < <(find "$SQL_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ "${#SQL_FILES[@]}" -eq 0 ]]; then
  echo "No SQL files found in $SQL_DIR." >&2
  exit 1
fi

FAILURES=0

for SQL_FILE in "${SQL_FILES[@]}"; do
  ARGS=(--file "$SQL_FILE" --mode "$MODE" --raw-dir "$RAW_DIR")

  if [[ -n "$WINDOW" ]]; then
    ARGS+=(--window "$WINDOW")
  fi

  if ! node --experimental-strip-types "$QUERY_SCRIPT" "${ARGS[@]}"; then
    FAILURES=1
    if [[ "$(basename "$SQL_FILE")" == "00_smoke_dataset.sql" ]]; then
      break
    fi
  fi
done

REPORT_ARGS=(--raw-dir "$RAW_DIR")

if [[ -n "$OUTPUT" ]]; then
  REPORT_ARGS+=(--output "$OUTPUT")
fi

if ! node --experimental-strip-types "$REPORT_SCRIPT" "${REPORT_ARGS[@]}"; then
  FAILURES=1
fi

exit "$FAILURES"
