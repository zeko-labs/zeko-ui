#!/usr/bin/env nu

const mainnet_l1_archive_url = "https://api.minascan.io/archive/mainnet/v1/graphql"
const mainnet_l2_archive_url = "https://archive.mainnet.zeko.io/graphql"
const mainnet_outer_pk = "B62qipwmBKAhWoDr19ydyM3jr2Cwr6rVnrWYUUfLam8oCWedPSem4aC"
const mainnet_inner_pk = "B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"

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
	let token = (required-env "NORTHFLANK_TOKEN")
	let project_id = (required-env "NORTHFLANK_PROJECT_ID")
	let pipeline_id = (required-env "NORTHFLANK_PIPELINE_ID")
	let stage = (optional-env "NORTHFLANK_STAGE" "Production")
	let branch = (required-env "GITHUB_REF_NAME")
	let sha = (required-env "GITHUB_SHA")
	let run_number = (required-env "GITHUB_RUN_NUMBER")
	let repository = (required-env "GITHUB_REPOSITORY")

	print "# Northflank mainnet indexer commands"
	print (if $execute { "# Executing commands." } else { "# Dry-run. Re-run with --execute after review to mutate Northflank." })
	print ""
	print $"# Mainnet Northflank template argument values to configure securely before release:"
	print $"# MAINNET_L1_ARCHIVE_URL=($mainnet_l1_archive_url)"
	print $"# MAINNET_L2_ARCHIVE_URL=($mainnet_l2_archive_url)"
	print $"# MAINNET_OUTER_PK=($mainnet_outer_pk)"
	print $"# MAINNET_INNER_PK=($mainnet_inner_pk)"
	print ""

	let payload = $"'{\"name\":\"Bridge mainnet release ($run_number)\",\"description\":\"Triggered by ($repository) sha ($sha)\",\"overrides\":{\"actions-indexer-mainnet-pipeline-build\":{\"branch\":\"($branch)\",\"sha\":\"($sha)\"}}}'"
	let token_ref = (shell-env-ref "NORTHFLANK_TOKEN")
	let command = $"curl -fsS -X POST 'https://api.northflank.com/v1/projects/($project_id)/pipelines/($pipeline_id)/release-flows/($stage)/runs' -H \"Authorization: Bearer ($token_ref)\" -H 'Content-Type: application/json' --data ($payload)"
	run-step $execute "Trigger the reviewed Mainnet release flow" $command
}
