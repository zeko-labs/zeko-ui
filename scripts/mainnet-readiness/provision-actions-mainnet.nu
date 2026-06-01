#!/usr/bin/env nu

const mainnet_project_name = "actions-mainnet"
const default_supabase_region = "eu-west-1"

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

def shell-env-ref [name: string] {
	"$" + $name
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
	let supabase_size = (required-env "SUPABASE_SIZE")
	let mainnet_db_url = (optional-env "ACTIONS_MAINNET_DATABASE_URL" "")

	print "# Actions mainnet provisioning commands"
	print (if $execute { "# Executing commands." } else { "# Dry-run. Re-run with --execute after review to mutate infrastructure." })
	print ""

	let password_ref = (shell-env-ref "ACTIONS_MAINNET_DB_PASSWORD")
	run-step $execute "Create the fresh Supabase mainnet project" $"supabase projects create ($mainnet_project_name) --org-id '($supabase_org_id)' --db-password \"($password_ref)\" --region '($supabase_region)' --size '($supabase_size)' --yes"

	if ($mainnet_db_url == "") {
		print "# ACTIONS_MAINNET_DATABASE_URL is not set yet."
		print "# After Supabase returns the new project ref, verify the correct direct or pooled connection string, then export ACTIONS_MAINNET_DATABASE_URL and rerun this script to create GitHub/Cloudflare resources."
		print "# Example direct URL shape, subject to review:"
		print "# export ACTIONS_MAINNET_DATABASE_URL=\"postgresql://postgres:${ACTIONS_MAINNET_DB_PASSWORD}@db.${ACTIONS_MAINNET_PROJECT_REF}.supabase.co:5432/postgres\""
		return
	}

	let db_url_ref = (shell-env-ref "ACTIONS_MAINNET_DATABASE_URL")
	run-step $execute "Store the mainnet database URL in the GitHub mainnet environment" $"printf %s \"($db_url_ref)\" | gh secret set ACTIONS_MAINNET_DATABASE_URL --env mainnet --body-file -"
	run-step $execute "Create cached Cloudflare Hyperdrive for the mainnet Actions DB" $"pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-cache --connection-string \"($db_url_ref)\" --max-age 5 --swr 5"
	run-step $execute "Create no-cache Cloudflare Hyperdrive for the mainnet Actions DB" $"pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-no-cache --connection-string \"($db_url_ref)\" --caching-disabled"

	print "# After Hyperdrive creation, replace these reviewed placeholders in services/actions/api/wrangler.jsonc:"
	print "# __MAINNET_REVIEW_REQUIRED_HYPERDRIVE_CACHE_ID__"
	print "# __MAINNET_REVIEW_REQUIRED_HYPERDRIVE_NO_CACHE_ID__"
}
