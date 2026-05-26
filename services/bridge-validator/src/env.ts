export type ValidatorSecretKey =
	| "WALLET_PRIVATE_KEY"
	| "SLACK_BOT_TOKEN"
	| "SLACK_CHANNEL_ID"
	| "VALIDATOR_API_TOKEN"

export type ValidatorConfigKey = "BRIDGE_VALIDATOR_BASE_URL"

export type ValidatorEnv = Env &
	Record<ValidatorSecretKey, string> &
	Record<ValidatorConfigKey, string>

const normalizeSecret = (value: string | undefined) => {
	const trimmed = value?.trim()
	if (!trimmed) {
		return ""
	}

	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).trim()
	}

	return trimmed
}

export const requireSecret = (env: ValidatorEnv, key: ValidatorSecretKey) => {
	const value = normalizeSecret(env[key])
	if (!value) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return value
}

export const requireConfig = (env: ValidatorEnv, key: ValidatorConfigKey) => {
	const value = normalizeSecret(env[key])
	if (!value) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return value
}

export const getValidatorSecrets = (env: ValidatorEnv) => ({
	walletPrivateKey: requireSecret(env, "WALLET_PRIVATE_KEY"),
	slackBotToken: requireSecret(env, "SLACK_BOT_TOKEN"),
	slackChannelId: requireSecret(env, "SLACK_CHANNEL_ID"),
	apiToken: requireSecret(env, "VALIDATOR_API_TOKEN")
})

export const buildValidatorUrl = ({
	env,
	path
}: {
	env: ValidatorEnv
	path: string
}) => new URL(path, requireConfig(env, "BRIDGE_VALIDATOR_BASE_URL")).toString()

export const hasValidBearerToken = ({
	request,
	env
}: {
	request: Request
	env: ValidatorEnv
}) => request.headers.get("authorization") === `Bearer ${requireSecret(env, "VALIDATOR_API_TOKEN")}`
