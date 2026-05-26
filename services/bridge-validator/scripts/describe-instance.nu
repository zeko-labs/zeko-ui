use ./env.nu [default-wrangler-config]

export def main [
	wrangler_config?: path
] {
	let instance_id = ($env.VALIDATOR_INSTANCE_ID? | default "" | str trim)
	if $instance_id == "" {
		error make { msg: "Missing required environment variable VALIDATOR_INSTANCE_ID" }
	}

	let wrangler_config = ($wrangler_config | default (default-wrangler-config))

	wrangler workflows instances describe bridge-validator $instance_id --config $wrangler_config
}
