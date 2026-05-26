use ./env.nu [
	default-env-file
	read-dotenv
	require-value
]

export def main [
	--logs
	env_file?: path
] {
	let env_file = ($env_file | default (default-env-file))
	let values = read-dotenv $env_file
	let instance_id = ($env.VALIDATOR_INSTANCE_ID? | default "" | str trim)
	if $instance_id == "" {
		error make { msg: "Missing required environment variable VALIDATOR_INSTANCE_ID" }
	}

	let token = require-value $values "VALIDATOR_API_TOKEN"
	let base_url = ($values | get --optional "BRIDGE_VALIDATOR_BASE_URL" | default "https://bridge-validator.zeko-labs.workers.dev" | str trim | str replace --regex '/+$' '')
	let logs_query = if $logs { "&logs=1" } else { "" }
	let url = $"($base_url)/bridge-status?instanceId=($instance_id)($logs_query)"

	http get --headers [authorization $"Bearer ($token)"] $url
}
