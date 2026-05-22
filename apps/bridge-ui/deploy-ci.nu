#!/usr/bin/env nu

const output_dir = "./.output"

def require-env [name: string] {
	let value = ($env | get --optional $name)
	if ($value == null) or (($value | into string | str trim) == "") {
		error make { msg: $"Missing required environment variable ($name)" }
	}
	$value
}

def optional-env [name: string, fallback: string] {
	let value = ($env | get --optional $name)
	if ($value == null) or (($value | into string | str trim) == "") {
		$fallback
	} else {
		$value | into string
	}
}

def branch-hash [branch: string] {
	$branch | hash sha256 | str substring 0..39
}

def target-config [target: string] {
	match $target {
		"testnet" => {
			let commit = (require-env "WORKERS_CI_COMMIT_SHA")
			{
				sentry_environment: "testnet",
				sentry_release: $commit,
				wrangler_args: ["deploy", "--env", "testnet"]
			}
		},
		"mainnet" => {
			let commit = (require-env "WORKERS_CI_COMMIT_SHA")
			{
				sentry_environment: "mainnet",
				sentry_release: $commit,
				wrangler_args: ["deploy"]
			}
		},
		"preview" => {
			let branch = (require-env "WORKERS_CI_BRANCH")
			let commit = (require-env "WORKERS_CI_COMMIT_SHA")
			{
				sentry_environment: $"deploy-preview-(branch-hash $branch)",
				sentry_release: $commit,
				wrangler_args: ["versions", "upload", "--env", "testnet"]
			}
		},
		_ => {
			error make { msg: $"Invalid BRIDGE_UI_DEPLOY_TARGET ($target). Expected testnet, mainnet, or preview." }
		}
	}
}

def main [] {
	let target = (optional-env "BRIDGE_UI_DEPLOY_TARGET" "preview")
	let config = (target-config $target)

	require-env "SENTRY_ORG" | ignore
	require-env "SENTRY_DSN_PUBLIC" | ignore
	require-env "SENTRY_AUTH_TOKEN" | ignore
	let sentry_project = (optional-env "SENTRY_PROJECT" "zeko-bridge")

	$env.SENTRY_LOG_LEVEL = "debug"
	$env.PATH = $"($env.PATH):(pwd)/node_modules/.bin:(pwd)/../../node_modules/.bin"
	$env.SENTRY_ENVIRONMENT = $config.sentry_environment
	$env.SENTRY_RELEASE = $config.sentry_release

	print $"Building release ($env.SENTRY_RELEASE) with DSN ($env.SENTRY_DSN_PUBLIC) on environment ($env.SENTRY_ENVIRONMENT) ..."
	^moon run bridge-ui:build
	print "Build completed."

	print $"Releasing version ($env.SENTRY_RELEASE) to Sentry in environment ($env.SENTRY_ENVIRONMENT) ..."
	^sentry-cli releases new -p $sentry_project $env.SENTRY_RELEASE
	^sentry-cli releases set-commits $env.SENTRY_RELEASE --auto --ignore-missing
	^sentry-cli sourcemaps inject $output_dir
	^sentry-cli sourcemaps upload $"--release=($env.SENTRY_RELEASE)" $output_dir
	^sentry-cli deploys new $"--release=($env.SENTRY_RELEASE)" -e $env.SENTRY_ENVIRONMENT
	print "Sentry release and sourcemaps done."

	print $"Deploying Bridge UI target ($target) with wrangler ($config.wrangler_args | str join ' ') ..."
	^wrangler ...$config.wrangler_args
	print $"Deployment completed for target ($target)."

	print $"Finalizing Sentry release ($env.SENTRY_RELEASE) ..."
	^sentry-cli releases finalize $env.SENTRY_RELEASE
	print $"Sentry release ($env.SENTRY_RELEASE) finalized."
}
