use ./env.nu [
	default-env-file
	default-wallet-env-file
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

def read-optional-dotenv [env_file: path] {
	if ($env_file | path exists) {
		return (read-dotenv $env_file)
	}

	{}
}

def read-explicit-wallet-dotenv [env_file: path] {
	if not ($env_file | path exists) {
		error make { msg: $"Explicit wallet env file does not exist: ($env_file)" }
	}

	read-dotenv $env_file
}

def resolve-dotenv-wallet-env-file [env_file: path, wallet_env_override: string] {
	let env_dir = ($env_file | path expand | path dirname)
	$env_dir | path join $wallet_env_override | path expand
}

def require-wallet-file-value [wallet_values: record, key: string, wallet_env_file: path] {
	let value = ($wallet_values | get --optional $key | default "" | str trim)
	if $value == "" {
		error make { msg: $"Missing required wallet value in ($wallet_env_file): ($key)" }
	}

	$value
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

	error make { msg: "Missing required wallet value: MINA_PRIVATE_KEY in .env.wallet.validator, or a legacy wallet key in .env" }
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

	error make { msg: "Missing required wallet value: PUBLIC_KEY in .env.wallet.validator, or a legacy public wallet key in .env" }
}

def resolve-wallet-keypair [wallet_values: record, values: record, wallet_env_file: path, use_wallet_file: bool] {
	if $use_wallet_file {
		return {
			private_key: (require-wallet-file-value $wallet_values "MINA_PRIVATE_KEY" $wallet_env_file)
			public_key: (require-wallet-file-value $wallet_values "PUBLIC_KEY" $wallet_env_file)
		}
	}

	{
		private_key: (resolve-wallet-private-key $values)
		public_key: (resolve-wallet-public-key $values)
	}
}

export def main [
	env_file?: path
	wrangler_config?: path
] {
	let env_file = ($env_file | default (default-env-file))
	let wrangler_config = ($wrangler_config | default (default-wrangler-config))
	let values = read-dotenv $env_file
	let wallet_env_override = ($values | get --optional "BRIDGE_VALIDATOR_WALLET_ENV_FILE" | default "" | str trim)
	let shell_wallet_env_override = ($env.BRIDGE_VALIDATOR_WALLET_ENV_FILE? | default "" | str trim)
	let has_explicit_wallet_env_file = $wallet_env_override != "" or $shell_wallet_env_override != ""
	let wallet_env_file = if $wallet_env_override != "" { resolve-dotenv-wallet-env-file $env_file $wallet_env_override } else { default-wallet-env-file }
	let use_wallet_file = $has_explicit_wallet_env_file or ($wallet_env_file | path exists)
	let wallet_values = if $use_wallet_file { read-explicit-wallet-dotenv $wallet_env_file } else { read-optional-dotenv $wallet_env_file }
	let wallet_keypair = resolve-wallet-keypair $wallet_values $values $wallet_env_file $use_wallet_file
	let wallet_private_key = $wallet_keypair.private_key
	let wallet_public_key = $wallet_keypair.public_key

	put-secret "WALLET_PRIVATE_KEY" $wallet_private_key $wrangler_config
	put-secret "WALLET_PUBLIC_KEY" $wallet_public_key $wrangler_config
	put-secret "SLACK_BOT_TOKEN" (require-value $values "SLACK_BOT_TOKEN") $wrangler_config
	put-secret "SLACK_CHANNEL_ID" (require-value $values "SLACK_CHANNEL_ID") $wrangler_config
	put-secret "VALIDATOR_API_TOKEN" (require-value $values "VALIDATOR_API_TOKEN") $wrangler_config
	put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REPOSITORY" $wrangler_config
	put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REF" $wrangler_config
	put-optional-secret $values "GITHUB_TOKEN" $wrangler_config

	print $"Cloudflare validator secrets synced from ($env_file) and ($wallet_env_file)"
}
