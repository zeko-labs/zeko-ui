/// <reference types="./worker-configuration.d.ts" />

declare namespace Cloudflare {
	interface Env {
		WALLET_PRIVATE_KEY: string
		SLACK_BOT_TOKEN: string
		SLACK_CHANNEL_ID: string
	}
}
