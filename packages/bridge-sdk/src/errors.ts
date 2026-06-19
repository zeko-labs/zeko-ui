import { UInt64, type PublicKey } from "o1js"

const NANOMINA_PER_MINA = 1_000_000_000n
const FIRST_WITHDRAWAL_TOO_SMALL_PREFIX = "First Zeko->Mina withdrawal amount is too small"

const formatNanomina = (value: bigint): string => {
	const whole = value / NANOMINA_PER_MINA
	const fraction = (value % NANOMINA_PER_MINA).toString().padStart(9, "0").replace(/0+$/, "")

	return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString()
}

export class InsufficientFirstWithdrawalAmountError extends Error {
	public readonly code = "INSUFFICIENT_FIRST_WITHDRAWAL_AMOUNT"

	constructor({
		amountNanomina,
		minimumAmountNanomina,
		recipient
	}: {
		amountNanomina: bigint
		minimumAmountNanomina: bigint
		recipient: string
	}) {
		super(
			`${FIRST_WITHDRAWAL_TOO_SMALL_PREFIX}: recipient ${recipient} cannot finalize this withdrawal with the current L1 account state, so the withdrawal must be at least ${formatNanomina(minimumAmountNanomina)} MINA to cover bridge proof fee plus any needed helper account and recipient payout account creation fees. This withdrawal is ${formatNanomina(amountNanomina)} MINA and cannot proceed as submitted.`
		)
		this.name = "InsufficientFirstWithdrawalAmountError"
	}
}

export const isInsufficientFirstWithdrawalAmountError = (error: unknown): boolean => {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "INSUFFICIENT_FIRST_WITHDRAWAL_AMOUNT"
	) {
		return true
	}

	const message = error instanceof Error ? error.message : String(error)
	return message.includes(FIRST_WITHDRAWAL_TOO_SMALL_PREFIX)
}

export const assertFirstWithdrawalAmountCanCreateHelper = ({
	helperAccountExists,
	recipientAccountExists,
	amount,
	recipient,
	accountCreationFee,
	bridgeProofFee
}: {
	helperAccountExists: boolean
	recipientAccountExists: boolean
	amount: UInt64
	recipient: PublicKey
	accountCreationFee: UInt64
	bridgeProofFee: UInt64
}): void => {
	const missingHelperFee = helperAccountExists ? UInt64.zero : accountCreationFee
	const missingRecipientFee = recipientAccountExists ? UInt64.zero : accountCreationFee
	const minimumAmount = bridgeProofFee.add(missingHelperFee).add(missingRecipientFee)

	if (amount.greaterThanOrEqual(minimumAmount).toBoolean()) return

	throw new InsufficientFirstWithdrawalAmountError({
		amountNanomina: amount.toBigInt(),
		minimumAmountNanomina: minimumAmount.toBigInt(),
		recipient: recipient.toBase58()
	})
}

export const ensureFirstWithdrawalAmountCanCreateHelper = async ({
	amount,
	recipient,
	accountCreationFee,
	bridgeProofFee,
	helperAccountExists,
	recipientAccountExists
}: {
	amount: UInt64
	recipient: PublicKey
	accountCreationFee: UInt64
	bridgeProofFee: UInt64
	helperAccountExists: () => boolean | Promise<boolean>
	recipientAccountExists: () => boolean | Promise<boolean>
}): Promise<void> => {
	if (
		amount
			.greaterThanOrEqual(accountCreationFee.add(accountCreationFee).add(bridgeProofFee))
			.toBoolean()
	)
		return

	const [hasHelperAccount, hasRecipientAccount] = await Promise.all([
		helperAccountExists(),
		recipientAccountExists()
	])

	assertFirstWithdrawalAmountCanCreateHelper({
		helperAccountExists: hasHelperAccount,
		recipientAccountExists: hasRecipientAccount,
		amount,
		recipient,
		accountCreationFee,
		bridgeProofFee
	})
}
