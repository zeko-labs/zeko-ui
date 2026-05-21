#!/usr/bin/env nu

def print-step [label: string, command: string] {
	print $"# ($label)"
	print $command
	print ""
}

def main [
	--execute
] {
	if $execute {
		error make { msg: "This helper is intentionally dry-run for review. Replace this guard only after PR review approves live provisioning." }
	}

	print "# Actions mainnet provisioning plan"
	print "# Dry-run only. No commands were executed."
	print ""

	print-step "Create a fresh Supabase project/database in zekoxyz's Org" "supabase projects create <actions-mainnet-project-name> --org-id <zekoxyz-org-id> --region <region>"
	print-step "Store the mainnet database URL in GitHub Actions secrets" "gh secret set ACTIONS_MAINNET_DATABASE_URL --env mainnet"
	print-step "Create cached Hyperdrive for mainnet Actions DB" 'pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-cache --connection-string "$ACTIONS_MAINNET_DATABASE_URL" --max-age 5 --swr 5'
	print-step "Create no-cache Hyperdrive for mainnet Actions DB" 'pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-no-cache --connection-string "$ACTIONS_MAINNET_DATABASE_URL" --caching-disabled'
	print-step "Record resulting Hyperdrive IDs" "Update services/actions/api/wrangler.jsonc top-level mainnet HYPERDRIVE and HYPERDRIVE_NO_CACHE binding IDs."
}
