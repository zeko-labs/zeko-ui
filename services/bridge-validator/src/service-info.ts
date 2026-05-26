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
		"moon run bridge-validator:trigger-deposit",
		"moon run bridge-validator:trigger-withdrawal"
	]
} as const
