import {
	createActionCoverageSnapshot,
	type OpsEnv,
	resolveOpsNetwork,
	resolveRouteEnv
} from "../../utils/ops"

type CloudflareContext = { env?: OpsEnv }

const queryNumber = (value: unknown): number | null => {
	const raw = Array.isArray(value) ? value[0] : value
	if (typeof raw !== "string" || raw.trim() === "") return null
	const parsed = Number(raw)
	return Number.isFinite(parsed) ? parsed : null
}

export default defineEventHandler((event) => {
	const cloudflare = event.context.cloudflare as CloudflareContext | undefined
	const env = resolveRouteEnv(cloudflare?.env)

	const query = getQuery(event)
	return createActionCoverageSnapshot(
		resolveOpsNetwork(query.network),
		{
			lastFetchedOuter: queryNumber(query.lastFetchedOuter),
			lastFetchedInner: queryNumber(query.lastFetchedInner)
		},
		env
	)
})
