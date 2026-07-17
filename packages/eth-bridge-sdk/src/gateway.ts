import { type Address, getAddress, type Hex, isAddress } from "viem"

export type BridgeConfig = {
	schemaVersion: 1
	chainId: number
	bridgeAddress: Address
	settlementAddress: Address
	ethereumDecimals: 18
	zekoNativeDecimals: 9
	ethereumConfirmations: number
	withdrawalDelaySlots: number
	currentVirtualSlot: number
}

export type DepositStatus = {
	nonce: number
	token: Address
	sender: Address
	zekoRecipient: Hex
	ethereumAmount: string
	zekoAmount: string
	timeout: number
	ethereumTransactionHash: Hex
	ethereumFinalized: boolean
	bridgeJobId: string | null
	bridgeJobStatus: string | null
	outerActionSequence: number | null
	outerActionStateAfter: string | null
	synchronizedSettlementSequence: number | null
	status: string
	nextAction: string
}

export type WithdrawalProof = {
	settlementSequence: number
	offset: number
	globalActionIndex: number
	recipient: Address
	amount: string
	actionFieldsHash: Hex
	siblings: Hex[]
	innerActionRoot: Hex
	commitSlotUpper: number
	claimableSlot: number
	currentVirtualSlot: number
	recipientCursor: number
	status: string
	nextAction: string
}

export type WithdrawalRequest = {
	globalActionIndex: number
	transactionHash: string
	blockHeight: number
	timestamp: string
	recipient: Address
	amount: string
	status: "pendingSettlement"
	nextAction: "waitForSettlement"
}

type Fetch = typeof globalThis.fetch

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`Invalid ${label} response`)
	}
	return value as Record<string, unknown>
}

const requireNumber = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
		throw new Error(`Invalid ${field}`)
	}
	return value
}

const requireString = (value: unknown, field: string): string => {
	if (typeof value !== "string") throw new Error(`Invalid ${field}`)
	return value
}

const requireUintString = (value: unknown, field: string): string => {
	const string = requireString(value, field)
	if (!/^(0|[1-9][0-9]*)$/.test(string) || BigInt(string) > 2n ** 64n - 1n) {
		throw new Error(`Invalid ${field}`)
	}
	return string
}

const requireHex = (value: unknown, field: string): Hex => {
	const string = requireString(value, field)
	if (!/^0x[0-9a-fA-F]+$/.test(string)) throw new Error(`Invalid ${field}`)
	return string as Hex
}

const nullableString = (value: unknown, field: string): string | null =>
	value === null ? null : requireString(value, field)

const nullableNumber = (value: unknown, field: string): number | null =>
	value === null ? null : requireNumber(value, field)

const requestJson = async (fetcher: Fetch, url: string): Promise<unknown> => {
	const response = await fetcher(url, { headers: { accept: "application/json" } })
	const body: unknown = await response.json()
	if (!response.ok) {
		const record = asRecord(body, "gateway error")
		throw new Error(
			typeof record.error === "string" ? record.error : `Gateway returned ${response.status}`
		)
	}
	return body
}

const parseDeposit = (value: unknown): DepositStatus => {
	const row = asRecord(value, "deposit")
	const token = requireString(row.token, "deposit.token")
	const sender = requireString(row.sender, "deposit.sender")
	if (!isAddress(token) || !isAddress(sender)) throw new Error("Invalid deposit Ethereum address")
	return {
		nonce: requireNumber(row.nonce, "deposit.nonce"),
		token: getAddress(token),
		sender: getAddress(sender),
		zekoRecipient: requireHex(row.zekoRecipient, "deposit.zekoRecipient"),
		ethereumAmount: requireString(row.ethereumAmount, "deposit.ethereumAmount"),
		zekoAmount: requireString(row.zekoAmount, "deposit.zekoAmount"),
		timeout: requireNumber(row.timeout, "deposit.timeout"),
		ethereumTransactionHash: requireHex(
			row.ethereumTransactionHash,
			"deposit.ethereumTransactionHash"
		),
		ethereumFinalized:
			typeof row.ethereumFinalized === "boolean"
				? row.ethereumFinalized
				: (() => {
						throw new Error("Invalid deposit.ethereumFinalized")
					})(),
		bridgeJobId: nullableString(row.bridgeJobId, "deposit.bridgeJobId"),
		bridgeJobStatus: nullableString(row.bridgeJobStatus, "deposit.bridgeJobStatus"),
		outerActionSequence: nullableNumber(row.outerActionSequence, "deposit.outerActionSequence"),
		outerActionStateAfter: nullableString(
			row.outerActionStateAfter,
			"deposit.outerActionStateAfter"
		),
		synchronizedSettlementSequence: nullableNumber(
			row.synchronizedSettlementSequence,
			"deposit.synchronizedSettlementSequence"
		),
		status: requireString(row.status, "deposit.status"),
		nextAction: requireString(row.nextAction, "deposit.nextAction")
	}
}

const parseWithdrawal = (value: unknown): WithdrawalProof => {
	const row = asRecord(value, "withdrawal")
	const recipient = requireString(row.recipient, "withdrawal.recipient")
	if (!isAddress(recipient)) throw new Error("Invalid withdrawal.recipient")
	if (!Array.isArray(row.siblings)) throw new Error("Invalid withdrawal.siblings")
	return {
		settlementSequence: requireNumber(row.settlementSequence, "withdrawal.settlementSequence"),
		offset: requireNumber(row.offset, "withdrawal.offset"),
		globalActionIndex: requireNumber(row.globalActionIndex, "withdrawal.globalActionIndex"),
		recipient: getAddress(recipient),
		amount: requireUintString(row.amount, "withdrawal.amount"),
		actionFieldsHash: requireHex(row.actionFieldsHash, "withdrawal.actionFieldsHash"),
		siblings: row.siblings.map((sibling) => requireHex(sibling, "withdrawal.sibling")),
		innerActionRoot: requireHex(row.innerActionRoot, "withdrawal.innerActionRoot"),
		commitSlotUpper: requireNumber(row.commitSlotUpper, "withdrawal.commitSlotUpper"),
		claimableSlot: requireNumber(row.claimableSlot, "withdrawal.claimableSlot"),
		currentVirtualSlot: requireNumber(row.currentVirtualSlot, "withdrawal.currentVirtualSlot"),
		recipientCursor: requireNumber(row.recipientCursor, "withdrawal.recipientCursor"),
		status: requireString(row.status, "withdrawal.status"),
		nextAction: requireString(row.nextAction, "withdrawal.nextAction")
	}
}

const parseWithdrawalRequest = (value: unknown): WithdrawalRequest => {
	const row = asRecord(value, "withdrawal request")
	const recipient = requireString(row.recipient, "withdrawalRequest.recipient")
	if (!isAddress(recipient)) throw new Error("Invalid withdrawalRequest.recipient")
	if (row.status !== "pendingSettlement" || row.nextAction !== "waitForSettlement") {
		throw new Error("Invalid withdrawalRequest progress")
	}
	return {
		globalActionIndex: requireNumber(row.globalActionIndex, "withdrawalRequest.globalActionIndex"),
		transactionHash: requireString(row.transactionHash, "withdrawalRequest.transactionHash"),
		blockHeight: requireNumber(row.blockHeight, "withdrawalRequest.blockHeight"),
		timestamp: requireString(row.timestamp, "withdrawalRequest.timestamp"),
		recipient: getAddress(recipient),
		amount: requireUintString(row.amount, "withdrawalRequest.amount"),
		status: "pendingSettlement",
		nextAction: "waitForSettlement"
	}
}

export class GatewayClient {
	readonly #baseUrl: string
	readonly #fetch: Fetch

	constructor(baseUrl: string, fetcher: Fetch = globalThis.fetch) {
		this.#baseUrl = baseUrl.replace(/\/$/, "")
		this.#fetch = fetcher
	}

	public get graphqlUrl(): string {
		return `${this.#baseUrl}/graphql`
	}

	public async config(): Promise<BridgeConfig> {
		const row = asRecord(
			await requestJson(this.#fetch, `${this.#baseUrl}/v1/bridge/config`),
			"bridge config"
		)
		const bridgeAddress = requireString(row.bridgeAddress, "config.bridgeAddress")
		const settlementAddress = requireString(row.settlementAddress, "config.settlementAddress")
		if (!isAddress(bridgeAddress) || !isAddress(settlementAddress)) {
			throw new Error("Invalid bridge configuration address")
		}
		if (row.schemaVersion !== 1 || row.ethereumDecimals !== 18 || row.zekoNativeDecimals !== 9) {
			throw new Error("Unsupported bridge configuration")
		}
		return {
			schemaVersion: 1,
			chainId: requireNumber(row.chainId, "config.chainId"),
			bridgeAddress: getAddress(bridgeAddress),
			settlementAddress: getAddress(settlementAddress),
			ethereumDecimals: 18,
			zekoNativeDecimals: 9,
			ethereumConfirmations: requireNumber(
				row.ethereumConfirmations,
				"config.ethereumConfirmations"
			),
			withdrawalDelaySlots: requireNumber(row.withdrawalDelaySlots, "config.withdrawalDelaySlots"),
			currentVirtualSlot: requireNumber(row.currentVirtualSlot, "config.currentVirtualSlot")
		}
	}

	public async deposit(nonce: number): Promise<DepositStatus> {
		return parseDeposit(
			await requestJson(this.#fetch, `${this.#baseUrl}/v1/bridge/deposits/${nonce}`)
		)
	}

	public async deposits(
		input: {
			zekoRecipient?: Hex
			after?: number
			limit?: number
		} = {}
	): Promise<DepositStatus[]> {
		const query = new URLSearchParams()
		if (input.zekoRecipient) query.set("zekoRecipient", input.zekoRecipient)
		if (input.after !== undefined) query.set("after", input.after.toString())
		if (input.limit !== undefined) query.set("limit", input.limit.toString())
		const body = await requestJson(
			this.#fetch,
			`${this.#baseUrl}/v1/bridge/deposits?${query.toString()}`
		)
		if (!Array.isArray(body)) throw new Error("Invalid deposits response")
		return body.map(parseDeposit)
	}

	public async withdrawals(
		input: {
			recipient?: Address
			after?: number
			limit?: number
		} = {}
	): Promise<WithdrawalProof[]> {
		const query = new URLSearchParams()
		if (input.recipient) query.set("recipient", input.recipient)
		if (input.after !== undefined) query.set("after", input.after.toString())
		if (input.limit !== undefined) query.set("limit", input.limit.toString())
		const body = await requestJson(
			this.#fetch,
			`${this.#baseUrl}/v1/bridge/withdrawals?${query.toString()}`
		)
		if (!Array.isArray(body)) throw new Error("Invalid withdrawals response")
		return body.map(parseWithdrawal)
	}

	public async withdrawalRequests(
		input: {
			recipient?: Address
			after?: number
			limit?: number
		} = {}
	): Promise<WithdrawalRequest[]> {
		const query = new URLSearchParams()
		if (input.recipient) query.set("recipient", input.recipient)
		if (input.after !== undefined) query.set("after", input.after.toString())
		if (input.limit !== undefined) query.set("limit", input.limit.toString())
		const body = await requestJson(
			this.#fetch,
			`${this.#baseUrl}/v1/bridge/withdrawal-requests?${query.toString()}`
		)
		if (!Array.isArray(body)) throw new Error("Invalid withdrawal requests response")
		return body.map(parseWithdrawalRequest)
	}

	public async withdrawal(settlementSequence: number, offset: number): Promise<WithdrawalProof> {
		return parseWithdrawal(
			await requestJson(
				this.#fetch,
				`${this.#baseUrl}/v1/bridge/withdrawals/${settlementSequence}/${offset}`
			)
		)
	}
}
