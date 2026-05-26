#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
LOCAL_WRANGLER="${REPO_ROOT}/node_modules/.pnpm/node_modules/.bin/wrangler"
DEFAULT_ENV_FILE="${REPO_ROOT}/.env"
DEFAULT_WRANGLER_CONFIG="${REPO_ROOT}/services/bridge-validator/wrangler.jsonc"
ENV_FILE="${1:-$DEFAULT_ENV_FILE}"
WRANGLER_CONFIG="${2:-$DEFAULT_WRANGLER_CONFIG}"

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

resolve_wallet_private_key() {
	local legacy_wallet_private_key="${WALLET_PRIVATE_KEY:-}"
	local bridge_mina_private_key="${ZEKO_BRIDGE_MINA_PRIVATE_KEY:-}"

	if [ -n "$legacy_wallet_private_key" ] && [ -n "$bridge_mina_private_key" ] && [ "$legacy_wallet_private_key" != "$bridge_mina_private_key" ]; then
		echo "WALLET_PRIVATE_KEY and ZEKO_BRIDGE_MINA_PRIVATE_KEY are both set but differ" >&2
		exit 1
	fi

	if [ -n "$legacy_wallet_private_key" ]; then
		printf '%s' "$legacy_wallet_private_key"
		return
	fi

	if [ -n "$bridge_mina_private_key" ]; then
		printf '%s' "$bridge_mina_private_key"
		return
	fi

	echo "Missing required secret in env file: WALLET_PRIVATE_KEY or ZEKO_BRIDGE_MINA_PRIVATE_KEY" >&2
	exit 1
}

put_secret() {
	local key="$1"
	local value="$2"

	if [ -x "$LOCAL_WRANGLER" ]; then
		printf '%s' "$value" | "$LOCAL_WRANGLER" secret put "$key" --config "$WRANGLER_CONFIG"
		return
	fi

	printf '%s' "$value" | pnpm exec wrangler secret put "$key" --config "$WRANGLER_CONFIG"
}

require_secret "SLACK_BOT_TOKEN"
require_secret "SLACK_CHANNEL_ID"
require_secret "VALIDATOR_API_TOKEN"

resolved_wallet_private_key="$(resolve_wallet_private_key)"

put_secret "WALLET_PRIVATE_KEY" "$resolved_wallet_private_key"

put_secret "SLACK_BOT_TOKEN" "$SLACK_BOT_TOKEN"
put_secret "SLACK_CHANNEL_ID" "$SLACK_CHANNEL_ID"
put_secret "VALIDATOR_API_TOKEN" "$VALIDATOR_API_TOKEN"

echo "Cloudflare validator secrets synced from $ENV_FILE"
