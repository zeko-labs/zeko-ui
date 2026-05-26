import type { BridgeValidatorRoute } from "./routes"
import { getValidatorRoute } from "./routes"
import type { BridgeValidationParams, BridgeValidationTimings } from "./types"
import type { BridgeValidationSummary } from "./validator"

type FetchLike = typeof fetch

const EXCERPT_LENGTH = 600
type SlackBlock =
	| { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
	| { type: "divider" }
	| { type: "section"; text: { type: "mrkdwn"; text: string } }
	| { type: "section"; fields: Array<{ type: "mrkdwn"; text: string }> }
	| { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }

const excerpt = (value: string): string => {
	const normalized = value.trim()
	if (normalized.length <= EXCERPT_LENGTH) {
		return normalized
	}

	return `${normalized.slice(0, EXCERPT_LENGTH)}...`
}

const escapeMrkdwn = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const linked = ({ text, url }: { text: string; url?: string }) =>
	url ? `<${url}|${escapeMrkdwn(text)}>` : escapeMrkdwn(text)

export const formatDuration = (durationMs: number) => {
	const safeMs = Math.max(0, Math.round(durationMs))
	const hours = Math.floor(safeMs / 3_600_000)
	const minutes = Math.floor((safeMs % 3_600_000) / 60_000)
	const seconds = Math.floor((safeMs % 60_000) / 1_000)
	const milliseconds = safeMs % 1_000
	const parts = [
		hours > 0 ? `${hours}h` : "",
		hours > 0 || minutes > 0 ? `${minutes}m` : "",
		`${seconds}.${milliseconds.toString().padStart(3, "0")}s`
	].filter(Boolean)

	return `${parts.join(" ")} (${safeMs} ms)`
}

const formatTimestamp = (timestampMs: number) => new Date(timestampMs).toISOString()

const formatTimingLines = (timings?: BridgeValidationTimings) => {
	if (!timings) return ["No timing data captured."]

	return [
		`*Workflow total:* ${formatDuration(timings.totalDurationMs)}`,
		`*Workflow started:* ${formatTimestamp(timings.workflowStartedAtMs)}`,
		`*Workflow finished:* ${formatTimestamp(timings.workflowFinishedAtMs)}`,
		timings.command
			? `*Bridge command:* ${formatDuration(timings.command.durationMs)} (${formatTimestamp(
					timings.command.startedAtMs
				)} -> ${formatTimestamp(timings.command.finishedAtMs)})`
			: "",
		...timings.steps.map(
			(step) => `- ${escapeMrkdwn(step.name)}: ${formatDuration(step.durationMs)}`
		)
	].filter(Boolean)
}

const buildTimingBlock = (timings?: BridgeValidationTimings): SlackBlock => ({
	type: "section",
	text: {
		type: "mrkdwn",
		text: ["*Timing*", ...formatTimingLines(timings)].join("\n").slice(0, 3000)
	}
})

const field = (label: string, value: string) => ({
	type: "mrkdwn" as const,
	text: `*${label}*\n${value}`
})

export const buildSlackFailureMessage = ({
	route,
	cliVersion,
	instanceId,
	stage,
	exitCode,
	stdout,
	stderr,
	message,
	timings
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	instanceId: string
	stage: string
	exitCode?: number
	stdout?: string
	stderr?: string
	message: string
	timings?: BridgeValidationTimings
}) =>
	[
		`Bridge validator failure`,
		`Workflow instance: ${instanceId}`,
		`Route: ${route.route}`,
		`CLI version: ${cliVersion}`,
		`Stage: ${stage}`,
		exitCode === undefined ? "" : `Exit code: ${exitCode}`,
		`Message: ${message}`,
		...formatTimingLines(timings),
		stdout ? `stdout: ${excerpt(stdout)}` : "",
		stderr ? `stderr: ${excerpt(stderr)}` : ""
	]
		.filter(Boolean)
		.join("\n")

export const buildSlackSuccessMessage = ({
	route,
	cliVersion,
	instanceId,
	summary,
	timings
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	instanceId: string
	summary: BridgeValidationSummary
	timings?: BridgeValidationTimings
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
		`Queued claims advanced: ${summary.queueAdvanceCount}`,
		...formatTimingLines(timings)
	].join("\n")

export const buildSlackFailureBlocks = ({
	route,
	cliVersion,
	instanceId,
	stage,
	exitCode,
	stdout,
	stderr,
	message,
	timings
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	instanceId: string
	stage: string
	exitCode?: number
	stdout?: string
	stderr?: string
	message: string
	timings?: BridgeValidationTimings
}): SlackBlock[] => [
	{
		type: "header",
		text: { type: "plain_text", text: "Bridge Validator Failed", emoji: false }
	},
	{
		type: "context",
		elements: [{ type: "mrkdwn", text: `Workflow \`${escapeMrkdwn(instanceId)}\`` }]
	},
	{
		type: "section",
		fields: [
			field("Route", `\`${route.route}\``),
			field("Direction", route.direction),
			field("Stage", `\`${escapeMrkdwn(stage)}\``),
			field("CLI", `\`${escapeMrkdwn(cliVersion)}\``),
			...(exitCode === undefined ? [] : [field("Exit code", `\`${exitCode}\``)])
		]
	},
	{ type: "section", text: { type: "mrkdwn", text: `*Failure*\n${escapeMrkdwn(message)}` } },
	buildTimingBlock(timings),
	...(stdout || stderr
		? [
				{ type: "divider" as const },
				{
					type: "section" as const,
					text: {
						type: "mrkdwn" as const,
						text: [
							stdout ? `*stdout*\n\`\`\`${escapeMrkdwn(excerpt(stdout))}\`\`\`` : "",
							stderr ? `*stderr*\n\`\`\`${escapeMrkdwn(excerpt(stderr))}\`\`\`` : ""
						]
							.filter(Boolean)
							.join("\n")
							.slice(0, 3000)
					}
				}
			]
		: [])
]

export const buildSlackSuccessBlocks = ({
	route,
	cliVersion,
	instanceId,
	summary,
	timings
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	instanceId: string
	summary: BridgeValidationSummary
	timings?: BridgeValidationTimings
}): SlackBlock[] => [
	{
		type: "header",
		text: { type: "plain_text", text: "Bridge Validator Passed", emoji: false }
	},
	{
		type: "context",
		elements: [{ type: "mrkdwn", text: `Workflow \`${escapeMrkdwn(instanceId)}\`` }]
	},
	{
		type: "section",
		fields: [
			field("Route", `\`${route.route}\``),
			field("Direction", route.direction),
			field("Amount", `\`${escapeMrkdwn(summary.amount)}\``),
			field("CLI", `\`${escapeMrkdwn(cliVersion)}\``),
			field("Operation", `\`${escapeMrkdwn(summary.operationId)}\``),
			field("Final transaction", linked({ text: summary.finalHash, url: summary.finalExplorerUrl }))
		]
	},
	{
		type: "section",
		fields: [
			field("History log", `\`${escapeMrkdwn(summary.logPath)}\``),
			field("Submitted transactions", String(summary.submittedTransactionCount)),
			field("History events", String(summary.historyEventCount)),
			field("Queued claims advanced", String(summary.queueAdvanceCount))
		]
	},
	buildTimingBlock(timings)
]

export const postSlackMessage = async ({
	token,
	channelId,
	text,
	blocks,
	fetchImpl = fetch
}: {
	token: string
	channelId: string
	text: string
	blocks?: SlackBlock[]
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
			text,
			...(blocks ? { blocks } : {})
		})
	})

	const payload = (await response.json()) as { ok?: boolean; error?: string }
	if (!response.ok || payload.ok !== true) {
		throw new Error(`Slack notification failed: ${payload.error ?? response.statusText}`)
	}
}

export const reportSlackFailure = async ({
	slackBotToken,
	slackChannelId,
	instanceId,
	routeKey,
	cliVersion,
	stage,
	exitCode,
	stdout,
	stderr,
	message,
	timings
}: {
	slackBotToken: string
	slackChannelId: string
	instanceId: string
	routeKey: BridgeValidationParams["routeKey"]
	cliVersion: string
	stage: string
	exitCode?: number
	stdout?: string
	stderr?: string
	message: string
	timings?: BridgeValidationTimings
}) => {
	const route = getValidatorRoute(routeKey)
	try {
		await postSlackMessage({
			token: slackBotToken,
			channelId: slackChannelId,
			text: buildSlackFailureMessage({
				instanceId,
				route,
				cliVersion,
				stage,
				exitCode,
				stdout,
				stderr,
				message,
				timings
			}),
			blocks: buildSlackFailureBlocks({
				instanceId,
				route,
				cliVersion,
				stage,
				exitCode,
				stdout,
				stderr,
				message,
				timings
			})
		})
	} catch (error) {
		console.error(
			`Bridge validator failure notification failed: ${
				error instanceof Error ? error.message : String(error)
			}`
		)
	}
}

export const reportSlackSuccess = async ({
	slackBotToken,
	slackChannelId,
	instanceId,
	routeKey,
	cliVersion,
	summary,
	timings
}: {
	slackBotToken: string
	slackChannelId: string
	instanceId: string
	routeKey: BridgeValidationParams["routeKey"]
	cliVersion: string
	summary: BridgeValidationSummary
	timings?: BridgeValidationTimings
}) => {
	const route = getValidatorRoute(routeKey)
	await postSlackMessage({
		token: slackBotToken,
		channelId: slackChannelId,
		text: buildSlackSuccessMessage({
			instanceId,
			route,
			cliVersion,
			summary,
			timings
		}),
		blocks: buildSlackSuccessBlocks({
			instanceId,
			route,
			cliVersion,
			summary,
			timings
		})
	})
}
