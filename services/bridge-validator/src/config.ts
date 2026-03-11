const requireEnv = (
	env: NodeJS.ProcessEnv,
	key:
		| "ZEKO_BRIDGE_MINA_PRIVATE_KEY"
		| "INNGEST_EVENT_KEY"
		| "INNGEST_SIGNING_KEY"
		| "SLACK_BOT_TOKEN"
		| "SLACK_CHANNEL_ID"
): string => {
	const value = env[key]
	if (!value) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return value
}

export const readValidatorEnv = (env: NodeJS.ProcessEnv = process.env) => ({
	minaPrivateKey: requireEnv(env, "ZEKO_BRIDGE_MINA_PRIVATE_KEY"),
	zekoPrivateKey: env.ZEKO_BRIDGE_ZEKO_PRIVATE_KEY ?? env.ZEKO_BRIDGE_MINA_PRIVATE_KEY ?? "",
	inngestEventKey: requireEnv(env, "INNGEST_EVENT_KEY"),
	inngestSigningKey: requireEnv(env, "INNGEST_SIGNING_KEY"),
	slackBotToken: requireEnv(env, "SLACK_BOT_TOKEN"),
	slackChannelId: requireEnv(env, "SLACK_CHANNEL_ID")
})
