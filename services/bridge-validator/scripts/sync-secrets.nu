use ./env.nu [
	default-env-file
	default-wrangler-config
	read-dotenv
	require-value
]

def put-secret [key: string, value: string, wrangler_config: path] {
	$value | pnpm exec wrangler secret put $key --config $wrangler_config
}

def put-optional-secret [values: record, key: string, wrangler_config: path] {
	let value = ($values | get --optional $key | default "" | str trim)
	if $value != "" {
		put-secret $key $value $wrangler_config
	}
}

def resolve-wallet-private-key [values: record] {
	let validator_private_key = ($values | get --optional "BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY" | default "" | str trim)
	let wallet_private_key = ($values | get --optional "WALLET_PRIVATE_KEY" | default "" | str trim)
	let bridge_private_key = ($values | get --optional "ZEKO_BRIDGE_MINA_PRIVATE_KEY" | default "" | str trim)
	let numbered_bridge_private_key = (
		[
			($values | get --optional "ZEKO_BRIDGE_MINA_PRIVATE_KEY_0" | default "" | str trim)
			($values | get --optional "ZEKO_BRIDGE_MINA_PRIVATE_KEY_1" | default "" | str trim)
		]
		| where { |value| $value != "" }
		| first
	)

	if $wallet_private_key != "" and $bridge_private_key != "" and $wallet_private_key != $bridge_private_key {
		error make { msg: "WALLET_PRIVATE_KEY and ZEKO_BRIDGE_MINA_PRIVATE_KEY are both set but differ" }
	}

	if $validator_private_key != "" {
		return $validator_private_key
	}

	if $wallet_private_key != "" {
		return $wallet_private_key
	}

	if $bridge_private_key != "" {
		return $bridge_private_key
	}

	if $numbered_bridge_private_key != null {
		return $numbered_bridge_private_key
	}

	error make { msg: "Missing required value in .env: BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY, WALLET_PRIVATE_KEY, ZEKO_BRIDGE_MINA_PRIVATE_KEY, ZEKO_BRIDGE_MINA_PRIVATE_KEY_0, or ZEKO_BRIDGE_MINA_PRIVATE_KEY_1" }
}

def resolve-wallet-public-key [values: record] {
	let validator_public_key = ($values | get --optional "BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY" | default "" | str trim)
	let wallet_public_key = ($values | get --optional "WALLET_PUBLIC_KEY" | default "" | str trim)

	if $validator_public_key != "" {
		return $validator_public_key
	}

	if $wallet_public_key != "" {
		return $wallet_public_key
	}

	error make { msg: "Missing required value in .env: BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY or WALLET_PUBLIC_KEY" }
}

export def main [
	env_file?: path
	wrangler_config?: path
] {
	let env_file = ($env_file | default (default-env-file))
	let wrangler_config = ($wrangler_config | default (default-wrangler-config))
	let values = read-dotenv $env_file
	let wallet_private_key = resolve-wallet-private-key $values
	let wallet_public_key = resolve-wallet-public-key $values

	put-secret "WALLET_PRIVATE_KEY" $wallet_private_key $wrangler_config
	put-secret "WALLET_PUBLIC_KEY" $wallet_public_key $wrangler_config
	put-secret "SLACK_BOT_TOKEN" (require-value $values "SLACK_BOT_TOKEN") $wrangler_config
	put-secret "SLACK_CHANNEL_ID" (require-value $values "SLACK_CHANNEL_ID") $wrangler_config
	put-secret "VALIDATOR_API_TOKEN" (require-value $values "VALIDATOR_API_TOKEN") $wrangler_config
	put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REPOSITORY" $wrangler_config
	put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REF" $wrangler_config
	put-optional-secret $values "GITHUB_TOKEN" $wrangler_config

	print $"Cloudflare validator secrets synced from ($env_file)"
}
