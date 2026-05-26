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
	repo-root | path join ".env"
}

export def default-wrangler-config [] {
	repo-root | path join "services/bridge-validator/wrangler.jsonc"
}
