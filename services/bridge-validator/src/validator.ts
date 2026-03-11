import { getValidatorRoute, type BridgeValidatorRouteKey } from "./routes"
import type { BridgeCliJsonResult, ScheduledValidation } from "./types"

export const DEFAULT_CLI_SPECIFIER = "@zeko-labs/bridge-cli@latest"
export const BRIDGE_VALIDATION_ROOT = "/workspace/bridge-validator"
export const BRIDGE_SCRIPT_PATH = `${BRIDGE_VALIDATION_ROOT}/run-bridge.sh`
export const BRIDGE_RESULT_PATH = `${BRIDGE_VALIDATION_ROOT}/result.json`
export const BRIDGE_PROGRESS_PATH = `${BRIDGE_VALIDATION_ROOT}/progress.log`
export const BRIDGE_VERSION_PATH = `${BRIDGE_VALIDATION_ROOT}/resolved-version.txt`
export const BRIDGE_PROCESS_ID = "bridge-command"
export const DEFAULT_BRIDGE_AMOUNT = "1"

export class BridgeValidationError extends Error {
	constructor(
		message: string,
		readonly stage: "process" | "json" | "result",
		readonly exitCode?: number,
		readonly stdout = "",
		readonly stderr = ""
	) {
		super(message)
	}
}

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'\"'\"'`)}'`

const CLI_SPECIFIER_PATTERN = /^[@a-z0-9._/-]+(?:@[a-z0-9._-]+)?$/i

const assertCliSpecifier = (cliSpecifier: string): string => {
	if (!CLI_SPECIFIER_PATTERN.test(cliSpecifier)) {
		throw new Error(`Unsupported CLI specifier: ${cliSpecifier}`)
	}

	return cliSpecifier
}

export const buildBridgeProcessScript = ({
	routeKey,
	cliSpecifier
}: {
	routeKey: BridgeValidatorRouteKey
	cliSpecifier: string
}) => {
	const route = getValidatorRoute(routeKey)
	const safeCliSpecifier = assertCliSpecifier(cliSpecifier)

	return [
		"#!/bin/sh",
		"set -eu",
		`mkdir -p ${shellQuote(BRIDGE_VALIDATION_ROOT)}`,
		`npm view ${safeCliSpecifier} version > ${shellQuote(BRIDGE_VERSION_PATH)}`,
		[
			"npx -y",
			safeCliSpecifier,
			"bridge",
			"--from",
			route.from,
			"--to",
			route.to,
			"--amount",
			DEFAULT_BRIDGE_AMOUNT,
			"--json"
		].join(" ") + ` > ${shellQuote(BRIDGE_RESULT_PATH)} 2> ${shellQuote(BRIDGE_PROGRESS_PATH)}`
	].join("\n")
}

export const buildScheduledValidations = ({
	scheduledTime,
	cliSpecifier = DEFAULT_CLI_SPECIFIER
}: {
	scheduledTime: number
	cliSpecifier?: string
}): ScheduledValidation[] => [
	{
		id: `bridge-validator-mina-to-zeko-${scheduledTime}`,
		params: {
			routeKey: "mina-to-zeko",
			cliSpecifier
		}
	},
	{
		id: `bridge-validator-zeko-to-mina-${scheduledTime}`,
		params: {
			routeKey: "zeko-to-mina",
			cliSpecifier
		}
	}
]

export const parseBridgeJson = (stdout: string): BridgeCliJsonResult => {
	try {
		return JSON.parse(stdout.trim()) as BridgeCliJsonResult
	} catch (error) {
		throw new BridgeValidationError(
			`Failed to parse bridge JSON output: ${error instanceof Error ? error.message : String(error)}`,
			"json",
			undefined,
			stdout
		)
	}
}
