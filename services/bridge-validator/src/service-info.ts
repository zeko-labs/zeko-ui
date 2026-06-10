export const BRIDGE_VALIDATOR_SERVICE_INFO = {
	ok: true,
	service: "bridge-validator",
	workflow: "bridge-validator",
	trigger: {
		type: "cron",
		configuredIn: "wrangler.jsonc triggers.crons",
		enabledBy: "BRIDGE_VALIDATOR_ENABLED"
	},
	sourceBuild: {
		repository: "BRIDGE_VALIDATOR_SOURCE_REPOSITORY",
		ref: "BRIDGE_VALIDATOR_SOURCE_REF"
	},
	scheduledRoutes: {
		mode: "both-per-event",
		deposit: "mina-to-zeko",
		withdrawal: "zeko-to-mina"
	},
	limits: {
		maxRuntimeMinutes: 120,
		commandTimeoutMinutes: 115,
		reportingReserveMinutes: 5
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
		"moon run bridge-validator:trigger-deposit",
		"moon run bridge-validator:trigger-withdrawal",
		"moon run bridge-validator:start-deposit",
		"moon run bridge-validator:start-withdrawal"
	]
} as const
