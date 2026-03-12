#!/usr/bin/env bash
set -u

WORKSPACE_DIR="${BRIDGE_METRICS_WORKSPACE_DIR:-}"
SQL_DIR="${BRIDGE_METRICS_SQL_DIR:-}"
QUERY_SCRIPT="${BRIDGE_METRICS_QUERY_SCRIPT:-}"
REPORT_SCRIPT="${BRIDGE_METRICS_REPORT_SCRIPT:-}"

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
    --workspace-dir)
      WORKSPACE_DIR="${2:-}"
      shift 2
      ;;
    --workspace-dir=*)
      WORKSPACE_DIR="${1#*=}"
      shift
      ;;
    --sql-dir)
      SQL_DIR="${2:-}"
      shift 2
      ;;
    --sql-dir=*)
      SQL_DIR="${1#*=}"
      shift
      ;;
    --query-script)
      QUERY_SCRIPT="${2:-}"
      shift 2
      ;;
    --query-script=*)
      QUERY_SCRIPT="${1#*=}"
      shift
      ;;
    --report-script)
      REPORT_SCRIPT="${2:-}"
      shift 2
      ;;
    --report-script=*)
      REPORT_SCRIPT="${1#*=}"
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

if [[ -z "$WORKSPACE_DIR" ]]; then
  echo "--workspace-dir or BRIDGE_METRICS_WORKSPACE_DIR is required." >&2
  exit 1
fi

if [[ -z "$SQL_DIR" ]]; then
  SQL_DIR="$WORKSPACE_DIR/analytics-engine/sql"
fi

if [[ -z "$QUERY_SCRIPT" ]]; then
  QUERY_SCRIPT="$WORKSPACE_DIR/analytics-engine/scripts/run-query.ts"
fi

if [[ -z "$REPORT_SCRIPT" ]]; then
  REPORT_SCRIPT="$WORKSPACE_DIR/analytics-engine/scripts/render-report.ts"
fi

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
