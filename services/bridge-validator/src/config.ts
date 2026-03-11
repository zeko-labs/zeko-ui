export interface ValidatorSecretEnv {
	ZEKO_BRIDGE_MINA_PRIVATE_KEY?: string
	ZEKO_BRIDGE_ZEKO_PRIVATE_KEY?: string
	SLACK_BOT_TOKEN?: string
	SLACK_CHANNEL_ID?: string
}

declare global {
	interface Env extends ValidatorSecretEnv {}
}

const requireEnv = (
	env: ValidatorSecretEnv,
	key: "ZEKO_BRIDGE_MINA_PRIVATE_KEY" | "SLACK_BOT_TOKEN" | "SLACK_CHANNEL_ID"
): string => {
	const value = env[key]
	if (!value) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return value
}

export const readValidatorEnv = (env: ValidatorSecretEnv) => ({
	minaPrivateKey: requireEnv(env, "ZEKO_BRIDGE_MINA_PRIVATE_KEY"),
	zekoPrivateKey: env.ZEKO_BRIDGE_ZEKO_PRIVATE_KEY ?? env.ZEKO_BRIDGE_MINA_PRIVATE_KEY ?? "",
	slackBotToken: requireEnv(env, "SLACK_BOT_TOKEN"),
	slackChannelId: requireEnv(env, "SLACK_CHANNEL_ID")
})
