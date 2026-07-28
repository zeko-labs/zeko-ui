import type { TadaDocumentNode } from "gql.tada"
import type { Field, NetworkId, PublicKey, UInt32, UInt64 } from "o1js"

export type Config = {
	l1Url: string
	l1ArchiveUrl: string
	zekoUrl: string
	zekoArchiveUrl: string
	l1Network: NetworkId
	l2Network: NetworkId
	actionsApi: string
	v2DepositsStartIndex?: number
	v2WithdrawalsStartIndex?: number
	pollTimeout?: number
	verbose?: boolean
}

export type Action = {
	action: Field[]
	beforeActionState: Field
	afterActionState: Field
	index: number
	timestamp: string
	hash: string
}

export type Deposit = {
	recipient: PublicKey
	amount: UInt64
	timeout: UInt32
	holderAccountL1: PublicKey
	/** Ethereum ERC20 asset identifier. Absent for native-token deposits. */
	assetId?: string
	/** Registry-bound Ethereum ERC20 action encoding. Absent only for native and legacy V1 actions. */
	encodingVersion?: 2
	registryIndex?: number
	recordCommitment?: Field
}

export type EthereumTokenBridgeConfig = {
	assetId: string
	ethereumTokenAddress: string
	tokenOwnerL2: PublicKey
	tokenIdL2: Field
	holderAccountL2: PublicKey
	verificationKeyHash: Field
}

export type EthereumAssetsConfig = {
	registryPublicKey: PublicKey
	registrationAuthority: PublicKey
	vaultPublicKey: PublicKey
	registrySchemaVersion: number
	registryRoot: Field
	registryCount: number
	approvedMftStandardVkId: Field
	approvedMftTokenVkHash: Field
	approvedMftAdminVkHash: Field
	universalBridgeVkId: Field
	universalBridgeVkHash: Field
	bridgeVerificationKeyHash: Field
	registryVerificationKeyHash: Field
}

export type EthereumAssetRecord = {
	schemaVersion: number
	registryIndex: number
	assetId: string
	ethereumTokenAddress: string
	tokenOwnerL2: PublicKey
	tokenIdL2: Field
	decimals: number
	inventoryCap: UInt64
	mftStandardVkId: Field
	vaultPublicKey: PublicKey
	universalBridgeVkId: Field
}

export type EthereumAssetMembership = {
	root: Field
	count: number
	schemaVersion: number
	record: EthereumAssetRecord
	path: Field[]
	witnessJson: string
}

export type EthereumAssetLookup =
	| { index: number }
	| { assetId: string }
	| { ethereumTokenAddress: string }

export type EthereumTokenDepositSelection = {
	readonly encodingVersion: 1 | 2
	readonly asset: EthereumAssetLookup
}

export type Withdrawal = {
	recipient: PublicKey
	amount: UInt64
}

export type WithdrawalRoute = "mina" | "ethereum"

export type SubmitWithdrawalParams = Withdrawal & {
	/** Account authorizing and funding the L2 debit. Defaults to recipient for Mina compatibility. */
	sender?: PublicKey
	/** Ethereum withdrawals do not reserve Mina L1 finalization or account-creation fees. */
	route?: WithdrawalRoute
}

export type BridgeVersion = 1 | 2

export type OuterActionBase = Action & {
	index: number
	slotRange: {
		lower: UInt32
		upper: UInt32
	}
}

export type OuterWitness = OuterActionBase & {
	type: "witness"
	aux: Field
}

export type OuterCommit = OuterActionBase & {
	type: "commit"
	ledger: Field
	innerActionState: Field
	innerActionStateLength: UInt32
	synchronizedOuterActionState: Field
	synchronizedOuterActionStateLength: UInt32
}

export type InnerWitness = Action & {
	index: number
	aux: Field
}

export type OuterAction = OuterWitness | OuterCommit

export type DepositWithState = Action &
	Deposit & {
		cancelled: boolean
		synced: boolean
		accepted: boolean
		confirmed: boolean
		finalised: boolean
		cancellable: boolean
		bridgeVersion: BridgeVersion
	}

export type DepositStateSnapshot = {
	deposits: DepositWithState[]
	syncedIndex: number
	acceptedIndex: number
	confirmedIndex: number
	finalisedIndex: number
	cancelledIndex: number
}

export const DepositStateProgress = {
	SYNCED: 0,
	ACCEPTED: 1,
	CONFIRMED: 2,
	FINALISED: 3
} as const

export type WithdrawalWithState = Action &
	Withdrawal & {
		committed: boolean
		finalised: boolean
		bridgeVersion: BridgeVersion
	}

export type InnerAction = InnerWitness

export type WithdrawalWithFinalised = Withdrawal & { finalised: boolean }

export type MaybeWithdrawal = InnerWitness & { withdrawal: WithdrawalWithFinalised | undefined }

export type InnerActionWithState = MaybeWithdrawal & {
	committed: boolean
	isPastWithdrawalDelay: boolean
}

export type Account = {
	zkappState?: string[] | null
	nonce?: string | null
}

export type WitnessFetchResult<T> =
	| { ok: true; value: T; index?: number }
	| { ok: false; msg: string; status?: WithdrawalFinalizationStatus; index?: number }

export type WithdrawalFinalizationStatus = "available" | "alreadyFinalised" | "waiting" | "blocked"

export type WithdrawalFinalizationResult = {
	available: boolean
	reason: string | null
	status: WithdrawalFinalizationStatus
	index?: number
}

export type ExtractInput<T> = T extends TadaDocumentNode<any, { input: infer I }, any> ? I : never
