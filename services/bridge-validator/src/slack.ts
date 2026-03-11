import type { BridgeValidatorRoute } from "./routes"

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
	stage,
	exitCode,
	stdout,
	stderr,
	message
}: {
	route: BridgeValidatorRoute
	cliVersion: string
	stage: string
	exitCode?: number
	stdout?: string
	stderr?: string
	message: string
}) =>
	[
		`Bridge validator failure`,
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

export const postSlackFailure = async ({
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
