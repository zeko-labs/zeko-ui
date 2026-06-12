type CloudflareEnvelope<T> = {
	success: boolean
	result: T
	errors: { code: number; message: string }[]
	result_info?: {
		page?: number
		per_page?: number
		count?: number
		total_count?: number
		total_pages?: number
	}
}

type AccessProvider = "cloudflare" | "github"

type AccessIdentityProvider = {
	id: string
	name: string
	type: string
	config?: Record<string, unknown>
}

type AccessPolicy = {
	id: string
	name: string
	decision: string
	precedence: number
	include?: unknown[]
}

type AccessApplication = {
	id: string
	name: string
	domain: string
	type: string
	policies?: AccessPolicy[]
}

const readDotEnv = async (path: string) => {
	const { readFile } = await import("node:fs/promises")
	try {
		const content = await readFile(path, "utf8")
		for (const line of content.split(/\r?\n/)) {
			const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
			if (match === null) continue
			const [, key, rawValue] = match
			if (process.env[key] !== undefined) continue
			process.env[key] = rawValue.replace(/^['"]|['"]$/g, "")
		}
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return
		throw error
	}
}

await readDotEnv("../../.env")

const requiredEnv = (key: string, fallbackKey?: string) => {
	const value = process.env[key]?.trim()
	if (value !== undefined && value !== "") return value
	const fallbackValue = fallbackKey === undefined ? undefined : process.env[fallbackKey]?.trim()
	if (fallbackValue !== undefined && fallbackValue !== "") return fallbackValue
	throw new Error(
		fallbackKey === undefined ? `${key} is required` : `${key} or ${fallbackKey} is required`
	)
}

const optionalEnv = (keys: readonly string[], fallback: string) => {
	for (const key of keys) {
		const value = process.env[key]?.trim()
		if (value) return value
	}
	return fallback
}

const optionalDashboardEnv = (key: string, fallback: string) =>
	optionalEnv([`ACTIONS_DASHBOARD_${key}`, `OPS_DASHBOARD_${key}`], fallback)

const resolveProvider = (): AccessProvider => {
	const value = optionalDashboardEnv("ACCESS_PROVIDER", "cloudflare")
	if (value === "cloudflare" || value === "github") return value
	throw new Error("ACTIONS_DASHBOARD_ACCESS_PROVIDER must be cloudflare or github")
}

const token = requiredEnv("CLOUDFLARE_API_TOKEN", "CFZT_TOKEN")
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID")
const hostname = optionalDashboardEnv("HOSTNAME", "actions.dashboard.zeko.io")
const appName = optionalDashboardEnv("ACCESS_APP_NAME", "Zeko Actions Dashboard")
const provider = resolveProvider()
const policyName = optionalDashboardEnv(
	"ACCESS_POLICY_NAME",
	provider === "cloudflare" ? "Allow Zeko Cloudflare account" : "Allow Zeko GitHub org"
)
const githubOrg = optionalDashboardEnv("GITHUB_ORG", "zeko-labs")
const githubIdpId =
	process.env.ACTIONS_DASHBOARD_GITHUB_IDP_ID?.trim() ||
	process.env.OPS_DASHBOARD_GITHUB_IDP_ID?.trim()

const apiUrl = (path: string) =>
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/access/${path}`

const requestEnvelope = async <T>(path: string, init: RequestInit = {}) => {
	const response = await fetch(apiUrl(path), {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
			...init.headers
		}
	})
	const payload = (await response.json()) as CloudflareEnvelope<T>
	if (!response.ok || !payload.success) {
		const errors = payload.errors?.map((error) => `${error.code}: ${error.message}`).join("; ")
		throw new Error(
			`Cloudflare API ${init.method ?? "GET"} ${path} failed (${response.status}): ${errors}`
		)
	}
	return payload
}

const request = async <T>(path: string, init: RequestInit = {}) =>
	(await requestEnvelope<T>(path, init)).result

const paginatedPath = (path: string, page: number, perPage: number) =>
	`${path}${path.includes("?") ? "&" : "?"}page=${page}&per_page=${perPage}`

const listAll = async <T>(path: string) => {
	const perPage = 100
	const firstPage = await requestEnvelope<T[]>(paginatedPath(path, 1, perPage))
	const totalPages = firstPage.result_info?.total_pages ?? 1
	const remainingPages = await Promise.all(
		Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
			requestEnvelope<T[]>(paginatedPath(path, index + 2, perPage))
		)
	)
	return [firstPage, ...remainingPages].flatMap((page) => page.result)
}

const upsertCloudflareIdp = async () => {
	const idps = await listAll<AccessIdentityProvider>("identity_providers")
	const existing = idps.find((idp) => idp.type === "cloudflare")
	const payload = {
		name: "Cloudflare",
		type: "cloudflare",
		config: {
			restrict_to_account_members: true
		}
	}
	if (existing === undefined) {
		const created = await request<AccessIdentityProvider>("identity_providers", {
			method: "POST",
			body: JSON.stringify(payload)
		})
		console.log(`Created Cloudflare identity provider ${created.name} (${created.id})`)
		return created
	}
	const updated = await request<AccessIdentityProvider>(`identity_providers/${existing.id}`, {
		method: "PUT",
		body: JSON.stringify({
			...payload,
			id: existing.id
		})
	})
	console.log(`Updated Cloudflare identity provider ${updated.name} (${updated.id})`)
	return updated
}

const findGithubIdp = async () => {
	const idps = await listAll<AccessIdentityProvider>("identity_providers")
	const githubIdps = idps.filter((idp) => idp.type === "github")
	if (githubIdpId !== undefined) {
		const selected = githubIdps.find((idp) => idp.id === githubIdpId)
		if (selected === undefined)
			throw new Error(`GitHub identity provider ${githubIdpId} was not found`)
		return selected
	}
	if (githubIdps.length === 0)
		throw new Error(
			"No GitHub Access identity provider exists. Create one with a GitHub OAuth app first, then rerun this task."
		)
	if (githubIdps.length > 1)
		throw new Error(
			`Multiple GitHub identity providers found: ${githubIdps
				.map((idp) => `${idp.name} (${idp.id})`)
				.join(", ")}. Set ACTIONS_DASHBOARD_GITHUB_IDP_ID.`
		)
	return githubIdps[0]
}

const resolveIdentityProvider = () =>
	provider === "cloudflare" ? upsertCloudflareIdp() : findGithubIdp()

const accessAppPayload = (identityProviderId: string) => ({
	name: appName,
	type: "self_hosted",
	domain: hostname,
	session_duration: "24h",
	allowed_idps: [identityProviderId],
	auto_redirect_to_identity: true,
	app_launcher_visible: false
})

const accessPolicyPayload = (identityProviderId: string) => ({
	name: policyName,
	decision: "allow",
	precedence: 1,
	include:
		provider === "cloudflare"
			? [
					{
						cloudflare_account_member: {
							account_id: accountId
						}
					}
				]
			: [
					{
						"github-organization": {
							name: githubOrg,
							identity_provider_id: identityProviderId
						}
					}
				]
})

const previousPolicyNames = new Set([
	policyName,
	"Allow Zeko GitHub org",
	"Allow Zeko Cloudflare account"
])

const upsertAccessApp = async (identityProviderId: string) => {
	const apps = await listAll<AccessApplication>("apps")
	const existing = apps.find((app) => app.domain === hostname || app.name === appName)
	if (existing === undefined) {
		const created = await request<AccessApplication>("apps", {
			method: "POST",
			body: JSON.stringify(accessAppPayload(identityProviderId))
		})
		console.log(`Created Access app ${created.name} (${created.id}) for ${hostname}`)
		return created
	}
	const updated = await request<AccessApplication>(`apps/${existing.id}`, {
		method: "PUT",
		body: JSON.stringify(accessAppPayload(identityProviderId))
	})
	console.log(`Updated Access app ${updated.name} (${updated.id}) for ${hostname}`)
	return updated
}

const deleteSupersededPolicies = async (appId: string, keepPolicyId: string) => {
	const policies = await listAll<AccessPolicy>(`apps/${appId}/policies`)
	const stalePolicies = policies.filter(
		(policy) => policy.id !== keepPolicyId && previousPolicyNames.has(policy.name)
	)
	for (const policy of stalePolicies) {
		await request<AccessPolicy>(`apps/${appId}/policies/${policy.id}`, {
			method: "DELETE"
		})
		console.log(`Deleted superseded Access policy ${policy.name} (${policy.id})`)
	}
}

const upsertAccessPolicy = async (app: AccessApplication, identityProviderId: string) => {
	const policies = await listAll<AccessPolicy>(`apps/${app.id}/policies`)
	const existing = policies.find((policy) => previousPolicyNames.has(policy.name))
	const policy =
		existing === undefined
			? await request<AccessPolicy>(`apps/${app.id}/policies`, {
					method: "POST",
					body: JSON.stringify(accessPolicyPayload(identityProviderId))
				})
			: await request<AccessPolicy>(`apps/${app.id}/policies/${existing.id}`, {
					method: "PUT",
					body: JSON.stringify(accessPolicyPayload(identityProviderId))
				})
	console.log(
		`${existing === undefined ? "Created" : "Updated"} Access policy ${policy.name} (${policy.id})`
	)
	await deleteSupersededPolicies(app.id, policy.id)
}

const formatTarget = () =>
	provider === "cloudflare" ? `Cloudflare account ${accountId}` : `GitHub organization ${githubOrg}`

const identityProvider = await resolveIdentityProvider()
console.log(`Using ${provider} identity provider ${identityProvider.name} (${identityProvider.id})`)
const app = await upsertAccessApp(identityProvider.id)
await upsertAccessPolicy(app, identityProvider.id)
console.log(`Access is configured for ${hostname} with ${formatTarget()}`)
