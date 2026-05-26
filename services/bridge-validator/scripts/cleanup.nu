use ./env.nu [
	default-env-file
	read-dotenv
	require-value
]

export def main [
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
	let url = $"($base_url)/bridge-cleanup?instanceId=($instance_id)"

	http post --max-time 30sec --headers [authorization $"Bearer ($token)"] $url "" | to json --raw
}
