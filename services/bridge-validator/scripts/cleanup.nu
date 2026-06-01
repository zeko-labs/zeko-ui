use ./env.nu [
	default-env-file
	read-dotenv
	require-value
]

export def main [
	--sandbox-id: string
	--attempt: int
	env_file?: path
] {
	let env_file = ($env_file | default (default-env-file))
	let values = read-dotenv $env_file
	let instance_id = ($env.VALIDATOR_INSTANCE_ID? | default "" | str trim)
	if $instance_id == "" {
		error make { msg: "Missing required environment variable VALIDATOR_INSTANCE_ID" }
	}

	let resolved_sandbox_id = ($sandbox_id | default ($env.VALIDATOR_SANDBOX_ID? | default "") | str trim)
	let resolved_attempt = ($attempt | default ($env.VALIDATOR_SANDBOX_ATTEMPT? | default ""))
	let sandbox_query = if $resolved_sandbox_id != "" {
		$"&sandboxId=($resolved_sandbox_id)"
	} else if ($resolved_attempt | into string | str trim) != "" {
		$"&attempt=($resolved_attempt)"
	} else {
		error make { msg: "Missing sandbox target: set VALIDATOR_SANDBOX_ATTEMPT or VALIDATOR_SANDBOX_ID" }
	}

	let token = require-value $values "VALIDATOR_API_TOKEN"
	let base_url = ($values | get --optional "BRIDGE_VALIDATOR_BASE_URL" | default "https://bridge-validator.zeko-labs.workers.dev" | str trim | str replace --regex '/+$' '')
	let url = $"($base_url)/bridge-cleanup?instanceId=($instance_id)($sandbox_query)"

	http post --max-time 30sec --headers [authorization $"Bearer ($token)"] $url "" | to json --raw
}
