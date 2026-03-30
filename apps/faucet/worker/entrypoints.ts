import { WorkerEntrypoint } from "cloudflare:workers"
import {
	enforceIpPolicies,
	executeClaim,
	getBearerToken,
	getRequestedAuthMethod,
	parseClaimRequest,
	parseTurnstileClaimInput,
	verifyGitHubUser
} from "./claim-service"
import { claimResultToResponse, isClaimResult, jsonError } from "./responses"
import type { ClaimResult, FaucetWorkerEnv, TurnstileClaimInput } from "./types"

// Turnstile claims are intentionally internal-only and must come through a service binding RPC call.
export class TurnstileClaimsEntrypoint extends WorkerEntrypoint<FaucetWorkerEnv> {
	async claimWithTurnstile(input: TurnstileClaimInput): Promise<ClaimResult> {
		const parsed = parseTurnstileClaimInput(input)
		if (isClaimResult(parsed)) return parsed

		const blocked = await enforceIpPolicies(parsed.clientIp, this.env)
		if (blocked) return blocked

		return executeClaim({
			body: parsed,
			env: this.env,
			claimContext: {
				authMethod: "turnstile",
				clientIp: parsed.clientIp
			}
		})
	}
}

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const url = new URL(request.url)

		if (url.pathname === "/healthcheck" || url.pathname === "/healthcheck/")
			return new Response("OK", { status: 200 })

		if (url.pathname !== "/claim" && url.pathname !== "/claim/")
			return jsonError(404, "not_found", "Route not found.")

		if (request.method !== "POST")
			return jsonError(405, "method_not_allowed", "Only POST is allowed for this route.", {
				Allow: "POST"
			})

		const body = await parseClaimRequest(request)
		if (isClaimResult(body)) return claimResultToResponse(body)

		const authMethod = getRequestedAuthMethod(request)
		if (authMethod && authMethod !== "github")
			return jsonError(
				400,
				"invalid_auth_method",
				"Public claim requests only accept GitHub bearer authentication."
			)

		const token = getBearerToken(request)
		if (!token)
			return jsonError(
				401,
				"missing_github_token",
				"A GitHub bearer token is required for public claim requests."
			)

		const githubUser = await verifyGitHubUser(token)
		if (isClaimResult(githubUser)) return claimResultToResponse(githubUser)

		return claimResultToResponse(
			await executeClaim({
				body,
				env,
				claimContext: {
					authMethod: "github",
					githubUser
				}
			})
		)
	}
} satisfies ExportedHandler<FaucetWorkerEnv>
