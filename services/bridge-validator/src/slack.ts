import type { BridgeValidatorRoute } from "./routes"
import { getValidatorRoute } from "./routes"
import type { BridgeValidationParams, BridgeValidationTimings } from "./types"
import type { BridgeValidationSummary } from "./validator"

type FetchLike = typeof fetch

const DIAGNOSTIC_TEXT_LIMIT = 12_000
const DIAGNOSTIC_BLOCK_LIMIT = 2_400
const textEncoder = new TextEncoder()
type SlackBlock =
	| { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
	| { type: "divider" }
	| { type: "section"; text: { type: "mrkdwn"; text: string } }
	| { type: "section"; fields: Array<{ type: "mrkdwn"; text: string }> }
	| { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }

const excerpt = (value: string, limit: number): string => {
	const normalized = value.trim()
	if (normalized.length <= limit) {
		return normalized
	}

	const omittedCount = normalized.length - limit
	const headLength = Math.floor(limit * 0.4)
	const tailLength = limit - headLength

	return [
		normalized.slice(0, headLength).trimEnd(),
		`... omitted ${omittedCount} characters ...`,
		normalized.slice(-tailLength).trimStart()
	].join("\n")
}

const escapeMrkdwn = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const sanitizeCodeBlock = (value: string) => value.replaceAll("```", "`\\`\\`")

const codeBlock = (label: string, value: string, limit: number) =>
	`*${label}*\n\`\`\`\n${sanitizeCodeBlock(excerpt(value, limit))}\n\`\`\``

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
			: ""
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

const buildDiagnosticBlocks = ({ stdout }: { stdout?: string }): SlackBlock[] =>
	[
		stdout ? codeBlock("stdout", stdout, DIAGNOSTIC_BLOCK_LIMIT) : "",
		"stderr is uploaded as a Slack text snippet when present."
	]
		.filter(Boolean)
		.map((text) => ({
			type: "section" as const,
			text: { type: "mrkdwn" as const, text }
		}))

export const buildSlackFailureMessage = ({
	route,
	cliVersion,
	walletPublicKey,
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
	walletPublicKey: string
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
		`Wallet: ${walletPublicKey}`,
		`Stage: ${stage}`,
		exitCode === undefined ? "" : `Exit code: ${exitCode}`,
		`Message: ${message}`,
		...formatTimingLines(timings),
		stdout ? codeBlock("stdout", stdout, DIAGNOSTIC_TEXT_LIMIT) : "",
		stderr ? "stderr: uploaded as Slack text snippet" : ""
	]
		.filter(Boolean)
		.join("\n")

export const buildSlackSuccessMessage = ({
	route,
	cliVersion,
	walletPublicKey,
	instanceId,
	summary,
	timings
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	walletPublicKey: string
	instanceId: string
	summary: BridgeValidationSummary
	timings?: BridgeValidationTimings
}) =>
	[
		"Bridge validator success",
		`Workflow instance: ${instanceId}`,
		`Route: ${route.route}`,
		`CLI version: ${cliVersion}`,
		`Wallet: ${walletPublicKey}`,
		`Operation ID: ${summary.operationId}`,
		`Amount: ${summary.amount}`,
		`Final hash: ${summary.finalHash}`,
		`Log path: ${summary.logPath}`,
		summary.cliReportedError ? `CLI warning: ${summary.cliReportedError}` : "",
		`Submitted transactions: ${summary.submittedTransactionCount}`,
		`History events: ${summary.historyEventCount}`,
		`Queued claims advanced: ${summary.queueAdvanceCount}`,
		...formatTimingLines(timings)
	]
		.filter(Boolean)
		.join("\n")

export const buildSlackFailureBlocks = ({
	route,
	cliVersion,
	walletPublicKey,
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
	walletPublicKey: string
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
			field("Wallet", `\`${escapeMrkdwn(walletPublicKey)}\``),
			field("CLI", `\`${escapeMrkdwn(cliVersion)}\``),
			...(exitCode === undefined ? [] : [field("Exit code", `\`${exitCode}\``)])
		]
	},
	{ type: "section", text: { type: "mrkdwn", text: `*Failure*\n${escapeMrkdwn(message)}` } },
	buildTimingBlock(timings),
	...(stdout || stderr ? [{ type: "divider" as const }, ...buildDiagnosticBlocks({ stdout })] : [])
]

export const buildSlackSuccessBlocks = ({
	route,
	cliVersion,
	walletPublicKey,
	instanceId,
	summary,
	timings
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	walletPublicKey: string
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
			field("Wallet", `\`${escapeMrkdwn(walletPublicKey)}\``),
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
	...(summary.cliReportedError
		? [
				{
					type: "section" as const,
					text: {
						type: "mrkdwn" as const,
						text: `*CLI warning*\n${escapeMrkdwn(summary.cliReportedError)}`
					}
				}
			]
		: []),
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

	const payload = (await response.json()) as {
		ok?: boolean
		error?: string
		channel?: string
		ts?: string
	}
	if (!response.ok || payload.ok !== true) {
		throw new Error(`Slack notification failed: ${payload.error ?? response.statusText}`)
	}

	return payload
}

export const uploadSlackTextSnippet = async ({
	token,
	channelId,
	title,
	filename,
	content,
	fetchImpl = fetch
}: {
	token: string
	channelId: string
	title: string
	filename: string
	content: string
	fetchImpl?: FetchLike
}) => {
	const bytes = textEncoder.encode(content)
	const uploadUrlResponse = await fetchImpl("https://slack.com/api/files.getUploadURLExternal", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded; charset=utf-8",
			authorization: `Bearer ${token}`
		},
		body: new URLSearchParams({
			filename,
			length: String(bytes.byteLength)
		}).toString()
	})
	const uploadUrlPayload = (await uploadUrlResponse.json()) as {
		ok?: boolean
		error?: string
		file_id?: string
		upload_url?: string
	}
	if (!uploadUrlResponse.ok || uploadUrlPayload.ok !== true) {
		throw new Error(
			`Slack snippet upload URL failed: ${uploadUrlPayload.error ?? uploadUrlResponse.statusText}`
		)
	}
	if (!uploadUrlPayload.upload_url || !uploadUrlPayload.file_id) {
		throw new Error("Slack snippet upload URL response was missing upload_url or file_id")
	}

	const uploadResponse = await fetchImpl(uploadUrlPayload.upload_url, {
		method: "POST",
		headers: {
			"content-type": "text/plain; charset=utf-8"
		},
		body: bytes
	})
	if (!uploadResponse.ok) {
		throw new Error(`Slack snippet content upload failed: ${uploadResponse.statusText}`)
	}

	const completeResponse = await fetchImpl("https://slack.com/api/files.completeUploadExternal", {
		method: "POST",
		headers: {
			"content-type": "application/json; charset=utf-8",
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			channel_id: channelId,
			files: [{ id: uploadUrlPayload.file_id, title }]
		})
	})
	const completePayload = (await completeResponse.json()) as { ok?: boolean; error?: string }
	if (!completeResponse.ok || completePayload.ok !== true) {
		throw new Error(
			`Slack snippet upload completion failed: ${completePayload.error ?? completeResponse.statusText}`
		)
	}
}

export const reportSlackFailure = async ({
	slackBotToken,
	slackChannelId,
	instanceId,
	routeKey,
	cliVersion,
	walletPublicKey,
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
	walletPublicKey: string
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
				walletPublicKey,
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
				walletPublicKey,
				stage,
				exitCode,
				stdout,
				stderr,
				message,
				timings
			})
		})
		if (stderr?.trim()) {
			await uploadSlackTextSnippet({
				token: slackBotToken,
				channelId: slackChannelId,
				title: `Bridge validator stderr: ${instanceId}`,
				filename: `bridge-validator-${instanceId}-stderr.log`,
				content: stderr
			})
		}
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
	walletPublicKey,
	summary,
	timings
}: {
	slackBotToken: string
	slackChannelId: string
	instanceId: string
	routeKey: BridgeValidationParams["routeKey"]
	cliVersion: string
	walletPublicKey: string
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
			walletPublicKey,
			summary,
			timings
		}),
		blocks: buildSlackSuccessBlocks({
			instanceId,
			route,
			cliVersion,
			walletPublicKey,
			summary,
			timings
		})
	})
}
