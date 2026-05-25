import type { BridgeValidatorRoute } from "./routes"
import type { BridgeValidationSummary } from "./validator"

type FetchLike = typeof fetch

const EXCERPT_LENGTH = 600

const excerpt = (value: string): string => {
	const normalized = value.trim()
	if (normalized.length <= EXCERPT_LENGTH) {
		return normalized
	}

	return `${normalized.slice(0, EXCERPT_LENGTH)}...`
}

export const buildSlackFailureMessage = ({
	route,
	cliVersion,
	instanceId,
	stage,
	exitCode,
	stdout,
	stderr,
	message
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	instanceId: string
	stage: string
	exitCode?: number
	stdout?: string
	stderr?: string
	message: string
}) =>
	[
		`Bridge validator failure`,
		`Workflow instance: ${instanceId}`,
		`Route: ${route.route}`,
		`CLI version: ${cliVersion}`,
		`Stage: ${stage}`,
		exitCode === undefined ? "" : `Exit code: ${exitCode}`,
		`Message: ${message}`,
		stdout ? `stdout: ${excerpt(stdout)}` : "",
		stderr ? `stderr: ${excerpt(stderr)}` : ""
	]
		.filter(Boolean)
		.join("\n")

export const buildSlackSuccessMessage = ({
	route,
	cliVersion,
	instanceId,
	summary
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	instanceId: string
	summary: BridgeValidationSummary
}) =>
	[
		"Bridge validator success",
		`Workflow instance: ${instanceId}`,
		`Route: ${route.route}`,
		`CLI version: ${cliVersion}`,
		`Operation ID: ${summary.operationId}`,
		`Amount: ${summary.amount}`,
		`Final hash: ${summary.finalHash}`,
		`Log path: ${summary.logPath}`,
		`Submitted transactions: ${summary.submittedTransactionCount}`,
		`History events: ${summary.historyEventCount}`,
		`Queued claims advanced: ${summary.queueAdvanceCount}`
	].join("\n")

export const postSlackMessage = async ({
	token,
	channelId,
	text,
	fetchImpl = fetch
}: {
	token: string
	channelId: string
	text: string
	fetchImpl?: FetchLike
}) => {
	const response = await fetchImpl("https://slack.com/api/chat.postMessage", {
		method: "POST",
		headers: {
			"content-type": "application/json; charset=utf-8",
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			channel: channelId,
			text
		})
	})

	const payload = (await response.json()) as { ok?: boolean; error?: string }
	if (!response.ok || payload.ok !== true) {
		throw new Error(`Slack notification failed: ${payload.error ?? response.statusText}`)
	}
}
