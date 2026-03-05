import { describe, expect, it } from "vitest"

const configuredBaseUrl = process.env.ACTIONS_API_E2E_BASE_URL?.trim()
const baseUrl =
	configuredBaseUrl && configuredBaseUrl.length > 0
		? configuredBaseUrl
		: "https://api.actions.zeko.io"

type HttpJsonResponse = {
	status: number
	elapsedMs: number
	text: string
	json: unknown
}

async function fetchJson(url: string, init?: RequestInit): Promise<HttpJsonResponse> {
	const startedAt = performance.now()
	const response = await fetch(url, init)
	const elapsedMs = Math.round(performance.now() - startedAt)
	const text = await response.text()
	let json: unknown = null

	try {
		json = JSON.parse(text)
	} catch {
		json = null
	}

	return { status: response.status, elapsedMs, text, json }
}

function formatFailure({
	label,
	url,
	status,
	elapsedMs,
	json,
	text
}: {
	label: string
	url: string
	status: number
	elapsedMs: number
	json: unknown
	text: string
}) {
	const parsed =
		json === null ? "<non-json>" : JSON.stringify(json, null, 2).slice(0, 2_000).trim() || "<empty>"
	const raw = text.slice(0, 2_000).trim() || "<empty>"
	return [
		`[LIVE E2E] ${label} failed`,
		`url: ${url}`,
		`status: ${status}`,
		`latency_ms: ${elapsedMs}`,
		`parsed_body:`,
		parsed,
		`raw_body:`,
		raw
	].join("\n")
}

type GraphQlBody = {
	data?: unknown
	errors?: unknown
}

describe("actions-api live e2e", () => {
	it("health endpoint reports healthy database", async () => {
		const url = `${baseUrl}/health`
		const result = await fetchJson(url)
		const body = result.json as {
			status?: string
			database?: { status?: string; error?: string }
		} | null

		const isHealthy =
			result.status === 200 && body?.status === "healthy" && body?.database?.status === "up"

		if (!isHealthy) {
			throw new Error(
				formatFailure({
					label: "health",
					url,
					status: result.status,
					elapsedMs: result.elapsedMs,
					json: result.json,
					text: result.text
				})
			)
		}
	})

	it("outerWitnessesFromAuxes query has no GraphQL errors", async () => {
		const url = `${baseUrl}/graphql`
		const result = await fetchJson(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				query: `query($auxes:[String!]!){
  outerWitnessesFromAuxes(input:{auxes:$auxes}){
    afterState
    beforeState
    index
    blockHeight
    slotRangeLower
    slotRangeUpper
    timestamp
    txnHash
    fields
    aux
    kind
  }
}`,
				variables: { auxes: ["0"] }
			})
		})

		const body = (result.json ?? {}) as GraphQlBody
		const hasErrors = Array.isArray(body.errors) && body.errors.length > 0
		const dataValue = (body.data as { outerWitnessesFromAuxes?: unknown } | undefined)
			?.outerWitnessesFromAuxes
		const hasArrayData = Array.isArray(dataValue)

		if (result.status !== 200 || hasErrors || !hasArrayData) {
			throw new Error(
				formatFailure({
					label: "outerWitnessesFromAuxes",
					url,
					status: result.status,
					elapsedMs: result.elapsedMs,
					json: result.json,
					text: result.text
				})
			)
		}

		expect(hasArrayData).toBe(true)
	})
})
