#!/usr/bin/env nu

def print-secret [name: string] {
	print $"gh secret set ($name) --env mainnet"
}

def main [
	--execute
] {
	if $execute {
		error make { msg: "This helper is intentionally dry-run for review. Replace this guard only after PR review approves GitHub secret changes." }
	}

	print "# GitHub mainnet environment and secret plan"
	print "# Dry-run only. No commands were executed."
	print ""
	print "gh api repos/:owner/:repo/environments/mainnet --method PUT"
	print-secret "ACTIONS_MAINNET_DATABASE_URL"
	print-secret "CLOUDFLARE_API_TOKEN"
print-secret "NORTHFLANK_API_TOKEN"
	print-secret "NORTHFLANK_PROJECT_ID"
	print-secret "NORTHFLANK_PIPELINE_ID"
	print-secret "NORTHFLANK_STAGE"
print-secret "SENTRY_AUTH_TOKEN"
	print-secret "SENTRY_ORG"
	print-secret "SENTRY_PROJECT"
	print-secret "SENTRY_DSN_PUBLIC"
}
