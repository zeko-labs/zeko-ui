use ./env.nu [
	default-env-file
	read-dotenv
	require-value
]

export def main [
	route_key: string
	env_file?: path
] {
	if $route_key != "mina-to-zeko" and $route_key != "zeko-to-mina" {
		error make { msg: "route_key must be mina-to-zeko or zeko-to-mina" }
	}

	let env_file = ($env_file | default (default-env-file))
	let values = read-dotenv $env_file
	let token = require-value $values "VALIDATOR_API_TOKEN"
	let base_url = ($values | get --optional "BRIDGE_VALIDATOR_BASE_URL" | default "https://bridge-validator.zeko-labs.workers.dev" | str trim | str replace --regex '/+$' '')
	let url = $"($base_url)/bridge-start"
	let body = { routeKey: $route_key } | to json --raw

	http post --max-time 30sec --content-type application/json --headers [authorization $"Bearer ($token)"] $url $body | to json --raw
}
