import type { BridgeValidatorRouteKey } from "./routes"

export type BridgeCliJsonResult = {
	success: boolean
	operation_id: string
	route: string
	direction: string
	status: string
	amount: string
	recipient: string
	submitted_transactions: Array<{ action: string; hash: string }>
	final_transaction: { action: string; hash: string; explorerUrl?: string } | null
	explorer_urls: string[]
	log_path: string
	error: string | null
}

export type BridgeValidationParams = {
	routeKey: BridgeValidatorRouteKey
}

export type ScheduledValidation = {
	id: string
	params: BridgeValidationParams
}

export type BridgeCommandCallbackPayload = {
	instanceId: string
	token: string
	exitCode: number
	stdout: string
	stderr: string
}
