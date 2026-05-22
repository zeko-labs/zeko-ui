#!/usr/bin/env nu

const environment_name = "mainnet"
const secret_names = [
	"ACTIONS_MAINNET_DATABASE_URL",
	"CLOUDFLARE_ACCOUNT_ID",
	"CLOUDFLARE_API_TOKEN",
	"NORTHFLANK_API_TOKEN",
	"SENTRY_AUTH_TOKEN",
	"SENTRY_DSN_PUBLIC",
	"SENTRY_ORG"
]
const variable_names = [
	"NORTHFLANK_PIPELINE_ID",
	"NORTHFLANK_PROJECT_ID",
	"NORTHFLANK_STAGE",
	"SENTRY_PROJECT"
]

def required-env [name: string] {
	let value = ($env | get --optional $name)
	if ($value == null) or (($value | into string | str trim) == "") {
		error make { msg: $"Missing required environment variable ($name)" }
	}
	$value | into string
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
	let repo = (required-env "GITHUB_REPOSITORY")

	print "# GitHub mainnet environment setup commands"
	print (if $execute { "# Executing commands." } else { "# Dry-run. Re-run with --execute after review to mutate GitHub." })
	print ""

	run-step $execute "Create or update the protected GitHub environment" $"gh api --method PUT 'repos/($repo)/environments/($environment_name)'"

	for name in $secret_names {
		run-step $execute $"Set secret ($name)" $"gh secret set ($name) --env ($environment_name) --body \"$($name)\""
	}

	for name in $variable_names {
		run-step $execute $"Set environment variable ($name)" $"gh variable set ($name) --env ($environment_name) --body \"$($name)\""
	}
}
