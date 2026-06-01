import * as v from "valibot"

export type ValidatorSecretKey =
	| "WALLET_PRIVATE_KEY"
	| "WALLET_PUBLIC_KEY"
	| "SLACK_BOT_TOKEN"
	| "SLACK_CHANNEL_ID"
	| "VALIDATOR_API_TOKEN"
	| "GITHUB_TOKEN"

export type ValidatorOptionalConfigKey =
	| "BRIDGE_VALIDATOR_ENABLED"
	| "BRIDGE_VALIDATOR_SOURCE_REPOSITORY"
	| "BRIDGE_VALIDATOR_SOURCE_REF"

export type ValidatorEnv = Env &
	Record<Exclude<ValidatorSecretKey, "GITHUB_TOKEN">, string> &
	Partial<Record<"GITHUB_TOKEN" | ValidatorOptionalConfigKey, string>>

const RequiredEnvValueSchema = v.pipe(v.string(), v.trim(), v.minLength(1))
const EnabledSchema = v.optional(v.pipe(v.string(), v.trim()), "true")

const requireEnvValue = (value: unknown, key: ValidatorSecretKey) => {
	const parsed = v.safeParse(RequiredEnvValueSchema, value)
	if (!parsed.success) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return parsed.output
}

export const requireSecret = (env: ValidatorEnv, key: ValidatorSecretKey) => {
	return requireEnvValue(env[key], key)
}

export const getValidatorSecrets = (env: ValidatorEnv) => ({
	walletPrivateKey: requireSecret(env, "WALLET_PRIVATE_KEY"),
	walletPublicKey: requireSecret(env, "WALLET_PUBLIC_KEY"),
	slackBotToken: requireSecret(env, "SLACK_BOT_TOKEN"),
	slackChannelId: requireSecret(env, "SLACK_CHANNEL_ID")
})

export const getSourceBuildConfig = (env: ValidatorEnv) => {
	const repository = env.BRIDGE_VALIDATOR_SOURCE_REPOSITORY?.trim()
	const ref = env.BRIDGE_VALIDATOR_SOURCE_REF?.trim()

	return repository && ref ? { repository, ref } : undefined
}

export const isValidatorEnabled = (env: ValidatorEnv) => {
	const enabled = v.parse(EnabledSchema, env.BRIDGE_VALIDATOR_ENABLED)
	return !["0", "false", "no", "off", "disabled"].includes(enabled.toLowerCase())
}

export const hasValidBearerToken = ({
	request,
	env
}: {
	request: Request
	env: ValidatorEnv
}) => request.headers.get("authorization") === `Bearer ${requireSecret(env, "VALIDATOR_API_TOKEN")}`
