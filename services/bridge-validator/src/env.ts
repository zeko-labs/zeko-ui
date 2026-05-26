import * as v from "valibot"

export type ValidatorSecretKey =
	| "WALLET_PRIVATE_KEY"
	| "SLACK_BOT_TOKEN"
	| "SLACK_CHANNEL_ID"
	| "VALIDATOR_API_TOKEN"

export type ValidatorConfigKey = "BRIDGE_VALIDATOR_BASE_URL"

export type ValidatorEnv = Env &
	Record<ValidatorSecretKey, string> &
	Record<ValidatorConfigKey, string>

const RequiredEnvValueSchema = v.pipe(v.string(), v.trim(), v.minLength(1))

const requireEnvValue = (value: unknown, key: ValidatorSecretKey | ValidatorConfigKey) => {
	const parsed = v.safeParse(RequiredEnvValueSchema, value)
	if (!parsed.success) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return parsed.output
}

export const requireSecret = (env: ValidatorEnv, key: ValidatorSecretKey) => {
	return requireEnvValue(env[key], key)
}

export const requireConfig = (env: ValidatorEnv, key: ValidatorConfigKey) => {
	return requireEnvValue(env[key], key)
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
