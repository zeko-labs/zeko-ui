import type { PublicKey, UInt64 } from "o1js"

const NANOMINA_PER_MINA = 1_000_000_000n
const INSUFFICIENT_BRIDGE_TRANSFER_AMOUNT_CODE = "INSUFFICIENT_BRIDGE_TRANSFER_AMOUNT"
const FIRST_WITHDRAWAL_TOO_SMALL_PREFIX = "First Zeko->Mina withdrawal amount is too small"

export type BridgeTransferDirection = "deposit" | "withdrawal"

type BridgeTransferFeeRequirement = {
	accountCreationFee: UInt64
	bridgeProofFee: UInt64
	recipientAccountExists: boolean
	helperAccountExists: boolean
}

type BridgeTransferAmountAssertion = BridgeTransferFeeRequirement & {
	direction: BridgeTransferDirection
	amount: UInt64
	recipient: PublicKey
}

const formatNanomina = (value: bigint): string => {
	const whole = value / NANOMINA_PER_MINA
	const fraction = (value % NANOMINA_PER_MINA).toString().padStart(9, "0").replace(/0+$/, "")

	return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString()
}

const transferLabel = (direction: BridgeTransferDirection): string =>
	direction === "deposit" ? "Mina->Zeko deposit" : "Zeko->Mina withdrawal"

export const minimumBridgeTransferAmount = ({
	accountCreationFee,
	bridgeProofFee,
	recipientAccountExists,
	helperAccountExists
}: BridgeTransferFeeRequirement): UInt64 => {
	const missingAccountCount = Number(!recipientAccountExists) + Number(!helperAccountExists)
	const accountCreationFees =
		missingAccountCount === 0
			? accountCreationFee.sub(accountCreationFee)
			: missingAccountCount === 1
				? accountCreationFee
				: accountCreationFee.add(accountCreationFee)

	return bridgeProofFee.add(bridgeProofFee).add(accountCreationFees)
}

export class InsufficientBridgeTransferAmountError extends Error {
	public readonly code: string = INSUFFICIENT_BRIDGE_TRANSFER_AMOUNT_CODE

	constructor({
		direction,
		amountNanomina,
		requiredAmountNanomina,
		recipient,
		missingAccountCount
	}: {
		direction: BridgeTransferDirection
		amountNanomina: bigint
		requiredAmountNanomina: bigint
		recipient: string
		missingAccountCount: number
	}) {
		const prefix =
			direction === "withdrawal"
				? FIRST_WITHDRAWAL_TOO_SMALL_PREFIX
				: `${transferLabel(direction)} amount is too small`
		super(
			`${prefix}: recipient ${recipient} requires ${missingAccountCount} destination account creation fee${missingAccountCount === 1 ? "" : "s"} and two bridge proof fees, so the transfer amount must be at least ${formatNanomina(requiredAmountNanomina)} MINA. This transfer is ${formatNanomina(amountNanomina)} MINA and cannot proceed as submitted.`
		)
		this.name = "InsufficientBridgeTransferAmountError"
		this.direction = direction
		this.requiredAmountNanomina = requiredAmountNanomina
	}

	public readonly direction: BridgeTransferDirection
	public readonly requiredAmountNanomina: bigint
}

export const isInsufficientBridgeTransferAmountError = (error: unknown): boolean => {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === INSUFFICIENT_BRIDGE_TRANSFER_AMOUNT_CODE
	) {
		return true
	}

	const message = error instanceof Error ? error.message : String(error)
	return message.includes("bridge proof fees") && message.includes("amount is too small")
}

export const assertBridgeTransferAmountCanCoverFees = ({
	direction,
	amount,
	recipient,
	accountCreationFee,
	bridgeProofFee,
	recipientAccountExists,
	helperAccountExists
}: BridgeTransferAmountAssertion): void => {
	const requiredAmount = minimumBridgeTransferAmount({
		accountCreationFee,
		bridgeProofFee,
		recipientAccountExists,
		helperAccountExists
	})
	if (amount.greaterThanOrEqual(requiredAmount).toBoolean()) return

	throw new InsufficientBridgeTransferAmountError({
		direction,
		amountNanomina: amount.toBigInt(),
		requiredAmountNanomina: requiredAmount.toBigInt(),
		recipient: recipient.toBase58(),
		missingAccountCount: Number(!recipientAccountExists) + Number(!helperAccountExists)
	})
}

export const ensureBridgeTransferAmountCanCoverFees = async ({
	direction,
	amount,
	recipient,
	accountCreationFee,
	bridgeProofFee,
	recipientAccountExists,
	helperAccountExists
}: Omit<BridgeTransferAmountAssertion, "recipientAccountExists" | "helperAccountExists"> & {
	recipientAccountExists: () => boolean | Promise<boolean>
	helperAccountExists: () => boolean | Promise<boolean>
}): Promise<void> => {
	const maximumRequiredAmount = minimumBridgeTransferAmount({
		accountCreationFee,
		bridgeProofFee,
		recipientAccountExists: false,
		helperAccountExists: false
	})
	if (amount.greaterThanOrEqual(maximumRequiredAmount).toBoolean()) return

	const [doesRecipientAccountExist, doesHelperAccountExist] = await Promise.all([
		recipientAccountExists(),
		helperAccountExists()
	])

	assertBridgeTransferAmountCanCoverFees({
		direction,
		amount,
		recipient,
		accountCreationFee,
		bridgeProofFee,
		recipientAccountExists: doesRecipientAccountExist,
		helperAccountExists: doesHelperAccountExist
	})
}

/**
 * @deprecated Use `InsufficientBridgeTransferAmountError`.
 */
export class InsufficientFirstWithdrawalAmountError extends InsufficientBridgeTransferAmountError {
	public override readonly code = "INSUFFICIENT_FIRST_WITHDRAWAL_AMOUNT"

	constructor({
		amountNanomina,
		accountCreationFeeNanomina,
		recipient
	}: {
		amountNanomina: bigint
		accountCreationFeeNanomina: bigint
		recipient: string
	}) {
		super({
			direction: "withdrawal",
			amountNanomina,
			requiredAmountNanomina: accountCreationFeeNanomina,
			recipient,
			missingAccountCount: 1
		})
		this.name = "InsufficientFirstWithdrawalAmountError"
	}
}

/**
 * @deprecated Use `isInsufficientBridgeTransferAmountError`.
 */
export const isInsufficientFirstWithdrawalAmountError = (error: unknown): boolean => {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "INSUFFICIENT_FIRST_WITHDRAWAL_AMOUNT"
	) {
		return true
	}

	return isInsufficientBridgeTransferAmountError(error)
}

/**
 * @deprecated Use `assertBridgeTransferAmountCanCoverFees`.
 */
export const assertFirstWithdrawalAmountCanCreateHelper = ({
	helperAccountExists,
	amount,
	recipient,
	accountCreationFee
}: {
	helperAccountExists: boolean
	amount: UInt64
	recipient: PublicKey
	accountCreationFee: UInt64
}): void => {
	if (amount.greaterThanOrEqual(accountCreationFee).toBoolean() || helperAccountExists) return

	throw new InsufficientFirstWithdrawalAmountError({
		amountNanomina: amount.toBigInt(),
		accountCreationFeeNanomina: accountCreationFee.toBigInt(),
		recipient: recipient.toBase58()
	})
}

/**
 * @deprecated Use `ensureBridgeTransferAmountCanCoverFees`.
 */
export const ensureFirstWithdrawalAmountCanCreateHelper = async ({
	amount,
	recipient,
	accountCreationFee,
	helperAccountExists
}: {
	amount: UInt64
	recipient: PublicKey
	accountCreationFee: UInt64
	helperAccountExists: () => boolean | Promise<boolean>
}): Promise<void> => {
	if (amount.greaterThanOrEqual(accountCreationFee).toBoolean()) return

	assertFirstWithdrawalAmountCanCreateHelper({
		helperAccountExists: await helperAccountExists(),
		amount,
		recipient,
		accountCreationFee
	})
}
