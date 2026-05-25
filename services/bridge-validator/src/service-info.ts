export const BRIDGE_VALIDATOR_SERVICE_INFO = {
	ok: true,
	service: "bridge-validator",
	workflow: "bridge-validator",
	trigger: {
		type: "cron",
		schedule: "0 */6 * * *"
	},
	runsPerSchedule: {
		deposit: "mina-to-zeko",
		withdrawal: "zeko-to-mina"
	},
	limits: {
		maxRuntimeMinutes: 120
	},
	validation: [
		"sandbox-command-execution",
		"hard-timeout",
		"sandbox-cleanup",
		"bridge-json-contract",
		"bridge-history-log",
		"slack-reporting"
	],
	manualTrigger: [
		'pnpm exec wrangler workflows trigger bridge-validator \'{"routeKey":"mina-to-zeko"}\' --config services/bridge-validator/wrangler.jsonc',
		'pnpm exec wrangler workflows trigger bridge-validator \'{"routeKey":"zeko-to-mina"}\' --config services/bridge-validator/wrangler.jsonc'
	]
} as const
