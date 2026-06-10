type CloudflareEnvelope<T> = {
	success: boolean
	result: T
	errors: { code: number; message: string }[]
}

type AccessIdentityProvider = {
	id: string
	name: string
	type: string
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

const optionalEnv = (key: string, fallback: string) => process.env[key]?.trim() || fallback

const token = requiredEnv("CLOUDFLARE_API_TOKEN", "CFZT_TOKEN")
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID")
const hostname = optionalEnv("OPS_DASHBOARD_HOSTNAME", "ops.zeko.io")
const appName = optionalEnv("OPS_DASHBOARD_ACCESS_APP_NAME", "Zeko Ops Dashboard")
const policyName = optionalEnv("OPS_DASHBOARD_ACCESS_POLICY_NAME", "Allow Zeko GitHub org")
const githubOrg = optionalEnv("OPS_DASHBOARD_GITHUB_ORG", "zeko-labs")
const githubIdpId = process.env.OPS_DASHBOARD_GITHUB_IDP_ID?.trim()

const apiUrl = (path: string) =>
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/access/${path}`

const request = async <T>(path: string, init: RequestInit = {}) => {
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
	return payload.result
}

const listAll = async <T>(path: string) => request<T[]>(path)

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
				.join(", ")}. Set OPS_DASHBOARD_GITHUB_IDP_ID.`
		)
	return githubIdps[0]
}

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
	include: [
		{
			"github-organization": {
				name: githubOrg,
				identity_provider_id: identityProviderId
			}
		}
	]
})

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

const upsertAccessPolicy = async (app: AccessApplication, identityProviderId: string) => {
	const policies = await listAll<AccessPolicy>(`apps/${app.id}/policies`)
	const existing = policies.find((policy) => policy.name === policyName)
	if (existing === undefined) {
		const created = await request<AccessPolicy>(`apps/${app.id}/policies`, {
			method: "POST",
			body: JSON.stringify(accessPolicyPayload(identityProviderId))
		})
		console.log(`Created Access policy ${created.name} (${created.id})`)
		return
	}
	const updated = await request<AccessPolicy>(`apps/${app.id}/policies/${existing.id}`, {
		method: "PUT",
		body: JSON.stringify(accessPolicyPayload(identityProviderId))
	})
	console.log(`Updated Access policy ${updated.name} (${updated.id})`)
}

const githubIdp = await findGithubIdp()
console.log(`Using GitHub identity provider ${githubIdp.name} (${githubIdp.id})`)
const app = await upsertAccessApp(githubIdp.id)
await upsertAccessPolicy(app, githubIdp.id)
console.log(`Access is configured for ${hostname} with GitHub org ${githubOrg}`)
