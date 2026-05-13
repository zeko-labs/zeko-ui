export type ChainFamily = "mina" | "zeko" | "eth"
export type NetworkTier = "testnet" | "mainnet"
export type ChainRef = `${ChainFamily}:${NetworkTier}`
export type Direction = "deposit" | "withdrawal"
export type OperationStatus = "running" | "completed" | "cancelled" | "failed"
export type OperationPhase =
	| "initializing"
	| "submitted"
	| "waiting-submission"
	| "waiting-prior-claims"
	| "waiting-finalization"
	| "retrying"
	| "finalizing"
	| "canceling"
	| "completed"
	| "cancelled"
	| "failed"

export type DepositStatus = {
	index: number
	amount: string
	recipient: string
	cancelled: boolean
	cancellable?: boolean
	synced: boolean
	accepted: boolean
	confirmed: boolean
	finalised: boolean
	hash: string
	timestamp: string
}

export type WithdrawalStatus = {
	index: number
	amount: string
	recipient: string
	committed: boolean
	finalised: boolean
	hash: string
	timestamp: string
}

export type TransactionResult = {
	success: true
	direction: Direction
	action: "submit" | "finalize" | "cancel"
	route: `${ChainRef}->${ChainRef}`
	hash: string
	explorerUrl: string
	included: boolean
	zkAppId?: string
}

export type StatusResult<T> = {
	success: true
	direction: Direction
	route: `${ChainRef}->${ChainRef}`
	account: string
	count: number
	operations: T[]
}

export type BridgeCapabilityDiagnostic = {
	available: boolean
	reason: string | null
	status?: "available" | "alreadyFinalised" | "waiting" | "blocked"
	index?: number
}

export type BridgeSdkOperation =
	| "submitDeposit"
	| "finalizeDeposit"
	| "cancelDeposit"
	| "submitWithdrawal"
	| "finalizeWithdrawal"
	| "getDepositStatuses"
	| "getWithdrawalStatuses"
	| "canFinalizeDeposit"
	| "canCancelDeposit"
	| "canFinalizeWithdrawal"

export type BridgeSdkCallTrace = {
	operation: BridgeSdkOperation
	attempt: number
	startedAt: string
	endedAt: string
	durationMs: number
	success: boolean
	message?: string
	result?: string
}

export type BridgeVerboseDiagnostics = {
	sdkCalls: BridgeSdkCallTrace[]
	sdkMethodStats: Partial<
		Record<
			BridgeSdkOperation,
			{
				count: number
				successCount: number
				errorCount: number
				totalDurationMs: number
				lastStartedAt?: string
				lastEndedAt?: string
				lastDurationMs?: number
				lastMessage?: string
				lastResult?: string
			}
		>
	>
	phaseTimings: Array<{
		phase: OperationPhase
		startedAt: string
		endedAt?: string
		durationMs: number
	}>
	waitReasons?: Partial<
		Record<
			"canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal",
			BridgeCapabilityDiagnostic
		>
	>
}

export type OperationLiveSnapshot = {
	refreshedAt: string
	nextAction: "wait" | "finalize" | "cancel" | "completed" | "cancelled"
	waitingOn?: "submission" | "prior-claims" | "finalization"
	targetIndex?: number
	claimableIndex?: number
	pendingAhead?: number
	canFinalize?: boolean
	canCancel?: boolean
	submitHash?: string
	observedCounts: {
		deposits: number
		withdrawals: number
	}
}

export type OperationSession = {
	id: string
	status: OperationStatus
	phase: OperationPhase
	route: `${ChainRef}->${ChainRef}`
	direction: Direction
	account: string
	recipient?: string
	amount: string
	logPath: string
	createdAt: string
	updatedAt: string
	timeoutSlots?: number
	lastError?: string
	targetIndex?: number
	pendingFinalizeIndex?: number
	pendingFinalizeSubmittedAt?: string
	pendingCancelMarker?: string
	queueAdvances?: number
	submittedTransactions: Array<{ action: "submit" | "finalize" | "cancel"; hash: string }>
	finalTransaction?: { action: "submit" | "finalize" | "cancel"; hash: string; explorerUrl: string }
	liveSnapshot?: OperationLiveSnapshot
	verboseDiagnostics?: BridgeVerboseDiagnostics
}

export type BridgeAdapter = {
	getDepositStatuses(account: string): Promise<DepositStatus[]>
	getWithdrawalStatuses(account: string): Promise<WithdrawalStatus[]>
	canFinalizeDeposit?(account?: string): Promise<boolean | BridgeCapabilityDiagnostic>
	canCancelDeposit?(account?: string): Promise<boolean | BridgeCapabilityDiagnostic>
	canFinalizeWithdrawal?(account?: string): Promise<boolean | BridgeCapabilityDiagnostic>
	submitDeposit(input: {
		account?: string
		recipient?: string
		amount: string
		timeoutSlots?: number
		wait: boolean
	}): Promise<TransactionResult>
	finalizeDeposit(input: { account?: string; wait: boolean }): Promise<TransactionResult>
	cancelDeposit(input: { account?: string; wait: boolean }): Promise<TransactionResult>
	submitWithdrawal(input: {
		account?: string
		recipient?: string
		amount: string
		wait: boolean
	}): Promise<TransactionResult>
	finalizeWithdrawal(input: { account?: string; wait: boolean }): Promise<TransactionResult>
}

export type BridgeAdapterFactory = (input: {
	from: ChainRef
	to: ChainRef
	verbose: boolean
}) => Promise<BridgeAdapter> | BridgeAdapter

export type AppPaths = {
	dataDir: string
	stateDir: string
	logDir: string
	cacheDir: string
}

export type RouteDescriptor = {
	from: ChainRef
	to: ChainRef
	enabled: boolean
	direction: Direction
	label: string
	reason?: string
}

export type LogFn = (entry: {
	event: string
	phase: OperationPhase
	details?: Record<string, unknown>
}) => Promise<void>

export type SignedTransactionResult = {
	hash?: string
	data?: { sendZkapp?: { zkapp?: { id?: string } } }
}
