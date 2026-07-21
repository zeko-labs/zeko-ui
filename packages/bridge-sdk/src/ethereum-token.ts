import {
	finalizeEthereumTokenDepositMutation,
	proveEthereumTokenWithdrawalRequestMutation
} from "@zeko-labs/graphql"
import { FungibleToken } from "mina-fungible-token"
import {
	AccountUpdate,
	AccountUpdateForest,
	Bool,
	type Field,
	Int64,
	Mina,
	PublicKey,
	TokenId,
	type UInt64,
	type Transaction
} from "o1js"
import { fetchDepositFinalizationWitnesses } from "./deposits"
import {
	normalizeEthereumAssetId,
	splitEthereumAssetId,
	validateEthereumTokenBridgeConfig
} from "./ethereum"
import { setL2 } from "./network"
import { pollProvedForest } from "./prover"
import type { BridgeRuntime } from "./runtime"
import {
	normalizeRetryableTransactionOptions,
	type RetryableTransactionOptions,
	type SignTransaction
} from "./transactions"
import type { EthereumTokenBridgeConfig } from "./types"
import { getVkHash, refreshCache } from "./utils"

export { validateEthereumTokenBridgeConfig } from "./ethereum"

const compilationByNetwork = new Map<string, Promise<void>>()

type JsonAccountUpdate = Parameters<typeof AccountUpdate.fromJSON>[0]

export const requireEthereumTokenBridgeConfig = (
	runtime: BridgeRuntime
): EthereumTokenBridgeConfig => {
	if (!runtime.ethereumToken) throw new Error("Ethereum ERC20 bridging is not configured")
	return validateEthereumTokenBridgeConfig(runtime.ethereumToken)
}

export const compileEthereumTokenStandard = async (runtime: BridgeRuntime): Promise<void> => {
	setL2(runtime)
	const key = JSON.stringify(runtime.config.l2Network)
	let compilation = compilationByNetwork.get(key)
	if (!compilation) {
		compilation = FungibleToken.compile().then(() => undefined)
		compilationByNetwork.set(key, compilation)
	}
	await compilation
}

export const parseProvedAccountUpdates = (forest: unknown[]): AccountUpdate[] => {
	try {
		const updates = forest.map((update) => AccountUpdate.fromJSON(update as JsonAccountUpdate))
		if (updates.length === 0 || updates[0]?.body.callDepth !== 0) {
			throw new Error("proved forest must start with a top-level account update")
		}
		for (let index = 1; index < updates.length; index++) {
			const depth = updates[index]?.body.callDepth
			const previousDepth = updates[index - 1]?.body.callDepth
			if (
				depth === undefined ||
				previousDepth === undefined ||
				depth < 0 ||
				depth > previousDepth + 1
			) {
				throw new Error("proved forest contains an invalid call depth")
			}
		}
		return updates
	} catch (error) {
		const reason = error instanceof Error ? `: ${error.message}` : ""
		throw new Error(`Invalid proved account-update forest${reason}`)
	}
}

export const assertMatchingFungibleTokenOwner = (
	left: AccountUpdate,
	leftUpdates: AccountUpdate[],
	right: AccountUpdate,
	rightUpdates: AccountUpdate[]
): void => {
	const leftInput = left.toPublicInput({ accountUpdates: leftUpdates })
	const rightInput = right.toPublicInput({ accountUpdates: rightUpdates })
	if (
		!leftInput.accountUpdate.equals(rightInput.accountUpdate).toBoolean() ||
		!leftInput.calls.equals(rightInput.calls).toBoolean()
	) {
		throw new Error("ERC20 withdrawal token-owner proof template does not match Zeko witness")
	}
}

const accountUpdateAsRootJson = (update: AccountUpdate): string => {
	const json = structuredClone(AccountUpdate.toJSON(update))
	json.body.callDepth = 0
	return JSON.stringify([json])
}

const requireProof = (update: AccountUpdate, verificationKeyHash: Field, label: string): void => {
	if (!update.body.authorizationKind.isProved.toBoolean()) {
		throw new Error(`${label} is not proof-authorized`)
	}
	if (!update.body.authorizationKind.verificationKeyHash.equals(verificationKeyHash).toBoolean()) {
		throw new Error(`${label} uses the wrong verification key`)
	}
	if (!update.authorization.proof) throw new Error(`${label} has no proof`)
}

const requireAccount = (
	update: AccountUpdate,
	publicKey: PublicKey,
	tokenId: Field,
	label: string
): void => {
	if (
		!update.publicKey.equals(publicKey).toBoolean() ||
		!update.tokenId.equals(tokenId).toBoolean()
	) {
		throw new Error(`${label} targets the wrong account`)
	}
}

export const validateEthereumTokenDepositForest = (
	config: EthereumTokenBridgeConfig,
	recipient: PublicKey,
	amount: UInt64,
	updates: AccountUpdate[]
): { vault: AccountUpdate; helper: AccountUpdate } => {
	const vault = updates[0]
	if (!vault) throw new Error("ERC20 deposit proof has no vault root")
	requireAccount(vault, config.holderAccountL2, config.tokenIdL2, "ERC20 deposit vault")
	requireProof(vault, config.verificationKeyHash, "ERC20 deposit vault")
	if (vault.balanceChange.toBigint() !== -amount.toBigInt()) {
		throw new Error("ERC20 deposit vault debits the wrong amount")
	}
	const helperTokenId = TokenId.derive(config.holderAccountL2, config.tokenIdL2)
	const helper = updates.find(
		(update) =>
			update.publicKey.equals(recipient).toBoolean() &&
			update.tokenId.equals(helperTokenId).toBoolean()
	)
	if (!helper) throw new Error("ERC20 deposit helper account update not found")
	return { vault, helper }
}

const attachFlatForest = (updates: AccountUpdate[]): void => {
	const parents: AccountUpdate[] = []
	for (const update of updates) {
		const depth = update.body.callDepth
		if (depth === 0) {
			AccountUpdate.attachToTransaction(update)
		} else {
			const parent = parents[depth - 1]
			if (!parent) throw new Error("Cannot attach account update without its parent")
			parent.approve(update)
		}
		parents[depth] = update
		parents.length = depth + 1
	}
}

const sendProvedTransaction = async (
	txn: Transaction<false, false>,
	signTxn: SignTransaction
): Promise<string> => {
	const proved = await txn.prove()
	const signed = await signTxn(proved)
	return (await signed.send()).hash
}

const refreshEthereumTokenAccounts = async (
	config: EthereumTokenBridgeConfig,
	feePayer: Mina.FeePayerSpec,
	account?: PublicKey
): Promise<void> => {
	await Promise.all([
		refreshCache(feePayer),
		refreshCache(config.tokenOwnerL2),
		refreshCache(config.holderAccountL2, config.tokenIdL2),
		account ? refreshCache(account, config.tokenIdL2) : Promise.resolve()
	])
}

const feePayerWithFee = (
	feePayer: Mina.FeePayerSpec,
	fee: UInt64
): { sender: PublicKey; fee: UInt64; memo?: string; nonce?: number } => {
	if (feePayer instanceof PublicKey) return { sender: feePayer, fee }
	if (!feePayer) throw new Error("ERC20 bridge transactions require an explicit fee payer")
	return { ...feePayer, fee }
}

export async function finalizeEthereumTokenDeposit(
	runtime: BridgeRuntime,
	feePayer: Mina.FeePayerSpec,
	recipient: PublicKey,
	signTxn: SignTransaction,
	options?: number | RetryableTransactionOptions
): Promise<string> {
	const config = requireEthereumTokenBridgeConfig(runtime)
	const { attempts, fee } = normalizeRetryableTransactionOptions(options)
	const [assetIdHigh, assetIdLow] = splitEthereumAssetId(config.assetId)
	const witnesses = await fetchDepositFinalizationWitnesses(
		runtime,
		recipient,
		(deposit) =>
			deposit.assetId !== undefined && normalizeEthereumAssetId(deposit.assetId) === config.assetId,
		TokenId.derive(config.holderAccountL2, config.tokenIdL2)
	)
	if (!witnesses.ok) throw new Error(witnesses.msg)
	const { witness, depositParams, helperAccount } = witnesses.value
	const helperTokenId = TokenId.derive(config.holderAccountL2, config.tokenIdL2)

	setL2(runtime)
	await compileEthereumTokenStandard(runtime)
	await Promise.all([
		refreshEthereumTokenAccounts(config, feePayer, recipient),
		refreshCache(recipient, helperTokenId)
	])

	const { data, error } = await runtime.l2Client().mutation(finalizeEthereumTokenDepositMutation, {
		input: {
			ase: witness.ase,
			prevNextDeposit: witness.prevNextDeposit,
			prevNonce: helperAccount?.nonce ?? "0",
			helperAccountNew: helperAccount === null,
			checkAccepted: {
				elems: witness.checkAccepted.elems,
				init: {
					depositIndex: witness.checkAccepted.init.depositIndex,
					originalActionState: witness.checkAccepted.init.orignalActionState,
					params: {
						assetIdHigh: assetIdHigh.toString(),
						assetIdLow: assetIdLow.toString(),
						base: witness.checkAccepted.init.params
					}
				}
			}
		}
	})
	if (!data?.request?.key) throw new Error(error?.message ?? "No ERC20 deposit proof key returned")
	const updates = parseProvedAccountUpdates(await pollProvedForest(runtime, data.request.key))
	const { helper } = validateEthereumTokenDepositForest(
		config,
		recipient,
		depositParams.deposit.amount,
		updates
	)

	const token = new FungibleToken(config.tokenOwnerL2)
	const txn = await Mina.transaction(feePayerWithFee(feePayer, fee), async () => {
		const helperHash = helper.hash()
		helper.requireSignature()
		if (!helper.hash().equals(helperHash).toBoolean()) {
			throw new Error("Signing the ERC20 deposit helper changed its proved body")
		}
		await token.approveBase(AccountUpdateForest.fromFlatArray(updates))
	})
	try {
		return await sendProvedTransaction(txn, signTxn)
	} catch (error) {
		if (attempts <= 1) throw error
		return await finalizeEthereumTokenDeposit(runtime, feePayer, recipient, signTxn, {
			attempts: attempts - 1,
			feeNanomina: fee.toBigInt()
		})
	}
}

export async function submitEthereumTokenWithdrawal(
	runtime: BridgeRuntime,
	feePayer: Mina.FeePayerSpec,
	input: { sender: PublicKey; recipient: PublicKey; amount: UInt64 },
	signTxn: SignTransaction,
	options?: RetryableTransactionOptions
): Promise<string> {
	const config = requireEthereumTokenBridgeConfig(runtime)
	const { fee } = normalizeRetryableTransactionOptions(options)
	const [assetIdHigh, assetIdLow] = splitEthereumAssetId(config.assetId)
	setL2(runtime)
	await compileEthereumTokenStandard(runtime)
	await refreshEthereumTokenAccounts(config, feePayer, input.sender)

	const token = new FungibleToken(config.tokenOwnerL2)
	let templateDebit: AccountUpdate | undefined
	let templateVault: AccountUpdate | undefined
	const template = await Mina.transaction(feePayerWithFee(feePayer, fee), async () => {
		templateDebit = AccountUpdate.default(input.sender, config.tokenIdL2)
		templateDebit.requireSignature()
		templateDebit.balanceChange = Int64.fromUnsigned(input.amount).neg()
		templateDebit.body.mayUseToken = {
			parentsOwnToken: Bool(true),
			inheritFromParent: Bool(false)
		}
		templateVault = AccountUpdate.default(config.holderAccountL2, config.tokenIdL2)
		templateVault.balance.addInPlace(input.amount)
		templateVault.body.mayUseToken = {
			parentsOwnToken: Bool(true),
			inheritFromParent: Bool(false)
		}
		templateVault.body.authorizationKind = {
			isSigned: Bool(false),
			isProved: Bool(true),
			verificationKeyHash: config.verificationKeyHash
		}
		await token.approveBase(AccountUpdateForest.fromFlatArray([templateDebit, templateVault]))
	})
	if (!templateDebit || !templateVault) throw new Error("Failed to build ERC20 withdrawal template")
	const templateOwner = template.transaction.accountUpdates.find(
		(update) =>
			update.publicKey.equals(config.tokenOwnerL2).toBoolean() &&
			update.tokenId.equals(TokenId.default).toBoolean()
	)
	if (!templateOwner?.lazyAuthorization || templateOwner.lazyAuthorization.kind !== "lazy-proof") {
		throw new Error("FungibleToken.approveBase did not create a token-owner proof")
	}

	const { data, error } = await runtime
		.l2Client()
		.mutation(proveEthereumTokenWithdrawalRequestMutation, {
			input: {
				withdrawalParams: {
					assetIdHigh: assetIdHigh.toString(),
					assetIdLow: assetIdLow.toString(),
					tokenOwner: accountUpdateAsRootJson(templateOwner),
					senderDebit: accountUpdateAsRootJson(templateDebit),
					amount: input.amount.toString(),
					recipient: input.recipient.toBase58()
				}
			}
		})
	if (!data?.request?.key) {
		throw new Error(error?.message ?? "No ERC20 withdrawal proof key returned")
	}
	const updates = parseProvedAccountUpdates(await pollProvedForest(runtime, data.request.key))
	const innerWitness = updates[0]
	if (!innerWitness) throw new Error("ERC20 withdrawal proof has no inner witness root")
	requireAccount(innerWitness, runtime.innerPk, TokenId.default, "ERC20 withdrawal witness")
	requireProof(innerWitness, await getVkHash(runtime.innerPk), "ERC20 withdrawal witness")
	const ownerIndex = updates.findIndex(
		(update) =>
			update.publicKey.equals(config.tokenOwnerL2).toBoolean() &&
			update.tokenId.equals(TokenId.default).toBoolean()
	)
	if (ownerIndex < 0) throw new Error("ERC20 withdrawal token owner not found")
	const provedOwner = updates[ownerIndex]
	const provedDebit = updates[ownerIndex + 1]
	const provedVault = updates[ownerIndex + 2]
	if (!provedOwner || !provedDebit || !provedVault) {
		throw new Error("ERC20 withdrawal token-owner subtree is incomplete")
	}
	assertMatchingFungibleTokenOwner(
		templateOwner,
		template.transaction.accountUpdates,
		provedOwner,
		updates
	)
	if (!provedDebit.hash().equals(templateDebit.hash()).toBoolean()) {
		throw new Error("ERC20 withdrawal sender debit changed during proving")
	}
	if (!provedVault.hash().equals(templateVault.hash()).toBoolean()) {
		throw new Error("ERC20 withdrawal vault receive changed during proving")
	}
	provedOwner.lazyAuthorization = templateOwner.lazyAuthorization
	provedDebit.lazyAuthorization = templateDebit.lazyAuthorization
	const finalTransaction = await Mina.transaction(feePayerWithFee(feePayer, fee), async () =>
		attachFlatForest(updates)
	)
	return await sendProvedTransaction(finalTransaction, signTxn)
}
