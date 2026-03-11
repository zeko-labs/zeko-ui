#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${1:-}"
WRANGLER_CONFIG="${2:-services/bridge-validator/wrangler.jsonc}"

if [ -z "$ENV_FILE" ]; then
	echo "Usage: bash services/bridge-validator/scripts/push-secrets-from-env.sh <env-file> [wrangler-config]" >&2
	exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
	echo "Env file not found: $ENV_FILE" >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require_secret() {
	local key="$1"
	local value="${!key:-}"

	if [ -z "$value" ]; then
		echo "Missing required secret in env file: $key" >&2
		exit 1
	fi
}

put_secret() {
	local key="$1"
	local value="$2"

	printf '%s' "$value" | pnpm exec wrangler secret put "$key" --config "$WRANGLER_CONFIG"
}

require_secret "ZEKO_BRIDGE_MINA_PRIVATE_KEY"
require_secret "SLACK_BOT_TOKEN"
require_secret "SLACK_CHANNEL_ID"

put_secret "ZEKO_BRIDGE_MINA_PRIVATE_KEY" "$ZEKO_BRIDGE_MINA_PRIVATE_KEY"

if [ -n "${ZEKO_BRIDGE_ZEKO_PRIVATE_KEY:-}" ]; then
	put_secret "ZEKO_BRIDGE_ZEKO_PRIVATE_KEY" "$ZEKO_BRIDGE_ZEKO_PRIVATE_KEY"
fi

put_secret "SLACK_BOT_TOKEN" "$SLACK_BOT_TOKEN"
put_secret "SLACK_CHANNEL_ID" "$SLACK_CHANNEL_ID"

echo "Cloudflare validator secrets synced from $ENV_FILE"
