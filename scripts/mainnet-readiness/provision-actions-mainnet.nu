#!/usr/bin/env nu

const mainnet_project_name = "actions-mainnet"
const default_supabase_region = "eu-west-1"
const default_supabase_size = "small"

def required-env [name: string] {
	let value = ($env | get --optional $name)
	if ($value == null) or (($value | into string | str trim) == "") {
		error make { msg: $"Missing required environment variable ($name)" }
	}
	$value | into string
}

def optional-env [name: string, fallback: string] {
	let value = ($env | get --optional $name)
	if ($value == null) or (($value | into string | str trim) == "") {
		$fallback
	} else {
		$value | into string
	}
}

def run-step [execute: bool, label: string, command: string] {
	print $"# ($label)"
	print $command
	print ""
	if $execute {
		^bash -lc $command
	}
}

def main [
	--execute
] {
	let supabase_org_id = (required-env "SUPABASE_ORG_ID")
	let supabase_db_password = (required-env "ACTIONS_MAINNET_DB_PASSWORD")
	let supabase_region = (optional-env "SUPABASE_REGION" $default_supabase_region)
	let supabase_size = (optional-env "SUPABASE_SIZE" $default_supabase_size)
	let mainnet_db_url = (required-env "ACTIONS_MAINNET_DATABASE_URL")

	print "# Actions mainnet provisioning commands"
	print (if $execute { "# Executing commands." } else { "# Dry-run. Re-run with --execute after review to mutate infrastructure." })
	print ""

	run-step $execute "Create the fresh Supabase mainnet project" $"supabase projects create ($mainnet_project_name) --org-id '($supabase_org_id)' --db-password '($supabase_db_password)' --region '($supabase_region)' --size '($supabase_size)' --yes"
	run-step $execute "Store the mainnet database URL in the GitHub mainnet environment" $"gh secret set ACTIONS_MAINNET_DATABASE_URL --env mainnet --body '($mainnet_db_url)'"
	run-step $execute "Create cached Cloudflare Hyperdrive for the mainnet Actions DB" $"pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-cache --connection-string '($mainnet_db_url)' --max-age 5 --swr 5"
	run-step $execute "Create no-cache Cloudflare Hyperdrive for the mainnet Actions DB" $"pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-no-cache --connection-string '($mainnet_db_url)' --caching-disabled"

	print "# After Hyperdrive creation, replace these reviewed placeholders in services/actions/api/wrangler.jsonc:"
	print "# __MAINNET_REVIEW_REQUIRED_HYPERDRIVE_CACHE_ID__"
	print "# __MAINNET_REVIEW_REQUIRED_HYPERDRIVE_NO_CACHE_ID__"
}
