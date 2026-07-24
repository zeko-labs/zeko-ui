import {
	finalizeEthereumTokenDepositMutation,
	proveEthereumTokenWithdrawalRequestMutation,
	registerEthereumAssetMutation
} from "@zeko-labs/graphql"
import { FungibleToken } from "mina-fungible-token"
import {
	AccountUpdate,
	AccountUpdateForest,
	Bool,
	Field,
	Int64,
	Mina,
	PublicKey,
	TokenId,
	type Transaction,
	type UInt64
} from "o1js"
import { fetchDepositFinalizationWitnesses } from "./deposits"
import { normalizeEthereumAssetId, splitEthereumAssetId } from "./ethereum"
import { fetchEthereumAsset, prepareEthereumAssetRegistration } from "./ethereum-assets"
import { setL2 } from "./network"
import { pollProvedForest } from "./prover"
import type { BridgeRuntime } from "./runtime"
import {
	normalizeRetryableTransactionOptions,
	type RetryableTransactionOptions,
	type SignTransaction
} from "./transactions"
import type {
	EthereumAssetLookup,
	EthereumAssetMembership,
	EthereumAssetRecord,
	EthereumTokenBridgeConfig
} from "./types"
import { getVkHash, refreshCache } from "./utils"

export { validateEthereumTokenBridgeConfig } from "./ethereum"

const compilationByNetwork = new Map<string, Promise<void>>()

type JsonAccountUpdate = Parameters<typeof AccountUpdate.fromJSON>[0]

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

export const buildEthereumTokenWithdrawalApproval = ({
	config,
	membership,
	registryPublicKey,
	sender,
	amount
}: {
	config: EthereumTokenBridgeConfig
	membership: Pick<EthereumAssetMembership, "root" | "count" | "schemaVersion">
	registryPublicKey: PublicKey
	sender: PublicKey
	amount: UInt64
}): {
	debit: AccountUpdate
	vault: AccountUpdate
	registry: AccountUpdate
	updates: AccountUpdate[]
	forest: AccountUpdateForest
} => {
	const debit = AccountUpdate.default(sender, config.tokenIdL2)
	debit.requireSignature()
	debit.balanceChange = Int64.fromUnsigned(amount).neg()
	debit.body.mayUseToken = {
		parentsOwnToken: Bool(true),
		inheritFromParent: Bool(false)
	}

	const vault = AccountUpdate.default(config.holderAccountL2, config.tokenIdL2)
	vault.balance.addInPlace(amount)
	vault.body.mayUseToken = {
		parentsOwnToken: Bool(true),
		inheritFromParent: Bool(false)
	}
	vault.body.authorizationKind = {
		isSigned: Bool(false),
		isProved: Bool(true),
		verificationKeyHash: config.verificationKeyHash
	}

	const registry = AccountUpdate.default(registryPublicKey)
	registry.body.callDepth = 1
	for (const [index, value] of [
		[0, membership.root],
		[1, Field(membership.count)],
		[2, Field(membership.schemaVersion)]
	] as const) {
		registry.body.preconditions.account.state[index] = {
			isSome: Bool(true),
			value
		}
	}

	const updates = [debit, vault, registry]
	return {
		debit,
		vault,
		registry,
		updates,
		forest: AccountUpdateForest.fromFlatArray(updates)
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
	if (vault.body.implicitAccountCreationFee.toBoolean()) {
		throw new Error("ERC20 deposit vault charges an implicit account-creation fee")
	}
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

export const graftEthereumTokenDepositHelperSignature = (helper: AccountUpdate): void => {
	const isSigned = helper.body.authorizationKind.isSigned
	if (!isSigned.isConstant() || !isSigned.toBoolean()) {
		throw new Error("ERC20 deposit helper body is not signature-authorized")
	}
	helper.lazyAuthorization = { kind: "lazy-signature" }
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

const uniqueForestAccounts = (
	updates: AccountUpdate[]
): Array<{ publicKey: PublicKey; tokenId: Field }> => {
	const accounts = new Map<string, { publicKey: PublicKey; tokenId: Field }>()
	for (const update of updates) {
		const account = { publicKey: update.publicKey, tokenId: update.tokenId }
		accounts.set(`${account.publicKey.toBase58()}:${account.tokenId.toString()}`, account)
	}
	return [...accounts.values()]
}

export const countMissingEthereumTokenAccounts = (updates: AccountUpdate[]): number =>
	uniqueForestAccounts(updates).filter(
		({ publicKey, tokenId }) => !Mina.hasAccount(publicKey, tokenId)
	).length

const refreshEthereumTokenForestAccounts = async (updates: AccountUpdate[]): Promise<void> => {
	await Promise.all(
		uniqueForestAccounts(updates).map(({ publicKey, tokenId }) => refreshCache(publicKey, tokenId))
	)
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

export async function canFinalizeEthereumTokenDeposit(
	runtime: BridgeRuntime,
	recipient: PublicKey,
	asset: EthereumAssetLookup
): Promise<{ available: boolean; reason: string | null; index?: number }> {
	const { config } = await fetchEthereumAsset(runtime, asset)
	const result = await fetchDepositFinalizationWitnesses(
		runtime,
		recipient,
		(deposit) =>
			deposit.assetId !== undefined && normalizeEthereumAssetId(deposit.assetId) === config.assetId,
		TokenId.derive(config.holderAccountL2, config.tokenIdL2)
	)
	return {
		available: result.ok,
		reason: result.ok ? null : result.msg,
		index: result.index
	}
}

export async function finalizeEthereumTokenDeposit(
	runtime: BridgeRuntime,
	feePayer: Mina.FeePayerSpec,
	recipient: PublicKey,
	asset: EthereumAssetLookup,
	signTxn: SignTransaction,
	options?: number | RetryableTransactionOptions
): Promise<string> {
	const { config, membership } = await fetchEthereumAsset(runtime, asset)
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
			asset: membership.witnessJson,
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
	graftEthereumTokenDepositHelperSignature(helper)
	await refreshEthereumTokenForestAccounts(updates)
	const newAccountCount = countMissingEthereumTokenAccounts(updates)

	const token = new FungibleToken(config.tokenOwnerL2)
	const transactionFeePayer = feePayerWithFee(feePayer, fee)
	const txn = await Mina.transaction(transactionFeePayer, async () => {
		if (newAccountCount > 0) {
			AccountUpdate.fundNewAccount(transactionFeePayer.sender, newAccountCount)
		}
		await token.approveBase(AccountUpdateForest.fromFlatArray(updates))
	})
	try {
		return await sendProvedTransaction(txn, signTxn)
	} catch (error) {
		if (attempts <= 1) throw error
		return await finalizeEthereumTokenDeposit(runtime, feePayer, recipient, asset, signTxn, {
			attempts: attempts - 1,
			feeNanomina: fee.toBigInt()
		})
	}
}

export async function submitEthereumTokenWithdrawal(
	runtime: BridgeRuntime,
	feePayer: Mina.FeePayerSpec,
	input: {
		sender: PublicKey
		recipient: PublicKey
		amount: UInt64
		asset: EthereumAssetLookup
	},
	signTxn: SignTransaction,
	options?: RetryableTransactionOptions
): Promise<string> {
	const { config, membership } = await fetchEthereumAsset(runtime, input.asset)
	const { fee } = normalizeRetryableTransactionOptions(options)
	const [assetIdHigh, assetIdLow] = splitEthereumAssetId(config.assetId)
	setL2(runtime)
	await compileEthereumTokenStandard(runtime)
	await refreshEthereumTokenAccounts(config, feePayer, input.sender)

	const assets = runtime.ethereumAssets
	if (!assets) throw new Error("Universal Ethereum asset bridging is not configured")
	const token = new FungibleToken(config.tokenOwnerL2)
	let templateDebit: AccountUpdate | undefined
	let templateVault: AccountUpdate | undefined
	const template = await Mina.transaction(feePayerWithFee(feePayer, fee), async () => {
		const approval = buildEthereumTokenWithdrawalApproval({
			config,
			membership,
			registryPublicKey: assets.registryPublicKey,
			sender: input.sender,
			amount: input.amount
		})
		templateDebit = approval.debit
		templateVault = approval.vault
		await token.approveBase(approval.forest)
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
				asset: membership.witnessJson,
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

export async function registerEthereumAsset(
	runtime: BridgeRuntime,
	feePayer: Mina.FeePayerSpec,
	candidate: EthereumAssetRecord,
	signTxn: SignTransaction,
	options?: RetryableTransactionOptions
): Promise<string> {
	const assets = runtime.ethereumAssets
	if (!assets) throw new Error("Universal Ethereum asset bridging is not configured")
	const { fee } = normalizeRetryableTransactionOptions(options)
	const registration = await prepareEthereumAssetRegistration(runtime, candidate)
	const { data, error } = await runtime
		.l2Client()
		.mutation(registerEthereumAssetMutation, { input: registration.witnessJson })
	if (!data?.request?.key) {
		throw new Error(error?.message ?? "No Ethereum asset registration proof key returned")
	}
	const updates = parseProvedAccountUpdates(await pollProvedForest(runtime, data.request.key))
	const registry = updates[0]
	if (!registry) throw new Error("Ethereum asset registration proof has no registry root")
	requireAccount(registry, assets.registryPublicKey, TokenId.default, "Ethereum asset registry")
	requireProof(registry, assets.registryVerificationKeyHash, "Ethereum asset registry")
	setL2(runtime)
	await Promise.all([refreshCache(feePayer), refreshEthereumTokenForestAccounts(updates)])
	const transaction = await Mina.transaction(feePayerWithFee(feePayer, fee), async () =>
		attachFlatForest(updates)
	)
	return await sendProvedTransaction(transaction, signTxn)
}
