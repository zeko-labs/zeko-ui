import type { BridgeValidatorRoute } from "./routes"
import { getValidatorRoute } from "./routes"
import type { BridgeValidationParams, BridgeValidationTimings } from "./types"
import type { BridgeValidationSummary } from "./validator"

type FetchLike = typeof fetch

const textEncoder = new TextEncoder()
type SlackApiErrorPayload = {
	ok?: boolean
	error?: string
	needed?: string
	provided?: string
}

type SlackBlock =
	| { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
	| { type: "divider" }
	| { type: "section"; text: { type: "mrkdwn"; text: string } }
	| { type: "section"; fields: Array<{ type: "mrkdwn"; text: string }> }
	| { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }

const escapeMrkdwn = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const hasDiagnosticText = (value?: string) => Boolean(value?.trim())

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

const buildSlackFileUploadFailureBlocks = ({
	instanceId,
	message
}: {
	instanceId: string
	message: string
}): SlackBlock[] => [
	{
		type: "section",
		text: {
			type: "mrkdwn",
			text: [
				"*Diagnostic file upload failed*",
				`Workflow \`${escapeMrkdwn(instanceId)}\``,
				escapeMrkdwn(message)
			].join("\n")
		}
	}
]

const field = (label: string, value: string) => ({
	type: "mrkdwn" as const,
	text: `*${label}*\n${value}`
})

const formatDiagnosticFileList = ({ stdout, stderr }: { stdout?: string; stderr?: string }) =>
	[hasDiagnosticText(stdout) ? "`stdout.log`" : "", hasDiagnosticText(stderr) ? "`stderr.log`" : ""]
		.filter(Boolean)
		.join(", ")

const formatSlackApiError = ({
	method,
	payload,
	statusText
}: {
	method: string
	payload: SlackApiErrorPayload
	statusText: string
}) =>
	[
		`${method} failed: ${payload.error ?? statusText}`,
		payload.needed ? `needed=${payload.needed}` : "",
		payload.provided ? `provided=${payload.provided}` : ""
	]
		.filter(Boolean)
		.join("; ")

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
		stdout || stderr
			? `Diagnostic file uploads requested: ${formatDiagnosticFileList({ stdout, stderr })}.`
			: ""
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
	...(hasDiagnosticText(stdout) || hasDiagnosticText(stderr)
		? [
				{ type: "divider" as const },
				{
					type: "section" as const,
					text: {
						type: "mrkdwn" as const,
						text: `*Diagnostics*\nDiagnostic file uploads requested: ${formatDiagnosticFileList({
							stdout,
							stderr
						})}`
					}
				}
			]
		: [])
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
	threadTs,
	fetchImpl = fetch
}: {
	token: string
	channelId: string
	text: string
	blocks?: SlackBlock[]
	threadTs?: string
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
			...(threadTs ? { thread_ts: threadTs } : {}),
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

export const uploadSlackTextFile = async ({
	token,
	channelId,
	title,
	filename,
	content,
	initialComment,
	threadTs,
	fetchImpl = fetch
}: {
	token: string
	channelId: string
	title: string
	filename: string
	content: string
	initialComment: string
	threadTs?: string
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
		needed?: string
		provided?: string
		file_id?: string
		upload_url?: string
	}
	if (!uploadUrlResponse.ok || uploadUrlPayload.ok !== true) {
		throw new Error(
			formatSlackApiError({
				method: "files.getUploadURLExternal",
				payload: uploadUrlPayload,
				statusText: uploadUrlResponse.statusText
			})
		)
	}
	if (!uploadUrlPayload.upload_url || !uploadUrlPayload.file_id) {
		throw new Error("Slack file upload URL response was missing upload_url or file_id")
	}

	const uploadResponse = await fetchImpl(uploadUrlPayload.upload_url, {
		method: "POST",
		headers: {
			"content-type": "application/octet-stream"
		},
		body: bytes
	})
	if (!uploadResponse.ok) {
		throw new Error(`Slack file content upload failed: ${uploadResponse.statusText}`)
	}

	const completeResponse = await fetchImpl("https://slack.com/api/files.completeUploadExternal", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded; charset=utf-8",
			authorization: `Bearer ${token}`
		},
		body: new URLSearchParams({
			channel_id: channelId,
			files: JSON.stringify([{ id: uploadUrlPayload.file_id, title }]),
			initial_comment: initialComment,
			...(threadTs ? { thread_ts: threadTs } : {})
		}).toString()
	})
	const completePayload = (await completeResponse.json()) as SlackApiErrorPayload
	if (!completeResponse.ok || completePayload.ok !== true) {
		throw new Error(
			formatSlackApiError({
				method: "files.completeUploadExternal",
				payload: completePayload,
				statusText: completeResponse.statusText
			})
		)
	}
}

const uploadDiagnosticFiles = async ({
	token,
	channelId,
	instanceId,
	stdout,
	stderr,
	threadTs
}: {
	token: string
	channelId: string
	instanceId: string
	stdout?: string
	stderr?: string
	threadTs?: string
}) => {
	if (hasDiagnosticText(stdout)) {
		await uploadSlackTextFile({
			token,
			channelId,
			title: `Bridge validator stdout: ${instanceId}`,
			filename: `bridge-validator-${instanceId}-stdout.log`,
			content: stdout ?? "",
			initialComment: "stdout.log",
			threadTs
		})
	}

	if (hasDiagnosticText(stderr)) {
		await uploadSlackTextFile({
			token,
			channelId,
			title: `Bridge validator stderr: ${instanceId}`,
			filename: `bridge-validator-${instanceId}-stderr.log`,
			content: stderr ?? "",
			initialComment: "stderr.log",
			threadTs
		})
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
		const messageResult = await postSlackMessage({
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
		try {
			await uploadDiagnosticFiles({
				token: slackBotToken,
				channelId: slackChannelId,
				instanceId,
				stdout,
				stderr,
				threadTs: messageResult.ts
			})
		} catch (error) {
			const uploadFailureMessage = `Bridge validator diagnostic upload failed: ${
				error instanceof Error ? error.message : String(error)
			}`
			console.error(uploadFailureMessage)
			await postSlackMessage({
				token: slackBotToken,
				channelId: slackChannelId,
				threadTs: messageResult.ts,
				text: uploadFailureMessage,
				blocks: buildSlackFileUploadFailureBlocks({
					instanceId,
					message: uploadFailureMessage
				})
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
