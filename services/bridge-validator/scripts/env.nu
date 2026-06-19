export def read-dotenv [env_file: path] {
	open --raw $env_file
	| lines
	| each { |line| $line | str trim }
	| where { |line| $line != "" and not ($line | str starts-with "#") }
	| parse --regex '^(?P<key>[A-Za-z_][A-Za-z0-9_]*)=(?P<value>.*)$'
	| reduce --fold {} { |row, acc|
		let value = (
			$row.value
			| str trim
			| str replace --regex '^"(.*)"$' '$1'
			| str replace --regex "^'(.*)'$" '$1'
			| str trim
		)
		$acc | upsert $row.key $value
	}
}

export def require-value [values: record, key: string] {
	let value = ($values | get --optional $key | default "" | str trim)
	if $value == "" {
		error make { msg: $"Missing required value in .env: ($key)" }
	}

	$value
}

export def repo-root [] {
	"../.." | path expand
}

export def default-env-file [] {
	let override = ($env.BRIDGE_VALIDATOR_ENV_FILE? | default "" | str trim)
	if $override != "" {
		return ($override | path expand)
	}

	let root = repo-root
	let candidates = [
		($root | path join ".env"),
		($root | path join "../../.." | path expand | path join ".env")
	]
	let found = ($candidates | where { |candidate| $candidate | path exists } | first)
	if ($found | is-not-empty) {
		return $found
	}

	$candidates | first
}

export def default-wallet-env-file [] {
	let override = ($env.BRIDGE_VALIDATOR_WALLET_ENV_FILE? | default "" | str trim)
	if $override != "" {
		return ($override | path expand)
	}

	repo-root | path join ".env.wallet.validator"
}

export def default-wrangler-config [] {
	repo-root | path join "services/bridge-validator/wrangler.jsonc"
}
