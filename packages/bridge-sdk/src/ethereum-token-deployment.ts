import { FungibleToken, FungibleTokenAdmin } from "mina-fungible-token"
import {
	AccountUpdate,
	AccountUpdateForest,
	Bool,
	Field,
	Mina,
	Permissions,
	PublicKey,
	TokenId,
	UInt8,
	UInt64,
	type VerificationKey
} from "o1js"
import { normalizeEthereumAssetId, validateEthereumTokenBridgeConfig } from "./ethereum"
import type { SignTransaction } from "./transactions"
import type { EthereumTokenBridgeConfig } from "./types"
import { refreshCache } from "./utils"

export type EthereumTokenSolidityRegistration = {
	registered: boolean
	allowed: boolean
	assetId: string
	ethereumTokenAddress: string
	zekoTokenOwnerL2: PublicKey
	zekoTokenIdL2: Field
	zekoDecimals: number
	ethereumDecimals: number
	depositCap: UInt64
}

export type EthereumTokenDeploymentPlan = {
	config: EthereumTokenBridgeConfig
	registration: EthereumTokenSolidityRegistration
	bridgeVerificationKey: VerificationKey
	decimals: number
	inventory: UInt64
}

export type EthereumTokenDeploymentManifest = {
	assetId: string
	ethereumTokenAddress: string
	tokenOwnerL2: string
	tokenIdL2: string
	adminContractL2: string
	adminAuthorityL2: string
	finalAdminContractL2: string
	finalAdminAuthorityL2: string
	holderAccountL2: string
	bridgeVerificationKeyHash: string
	decimals: number
	inventory: string
	deploymentTransactionHash: string
	vaultInstallationTransactionHash: string
	inventoryMintTransactionHash: string
	adminRotationTransactionHash: string
}

export type DeployEthereumTokenMirrorInput = EthereumTokenDeploymentPlan & {
	feePayer: PublicKey
	adminContractL2: PublicKey
	adminAuthorityL2: PublicKey
	finalAdminContractL2: PublicKey
	symbol: string
	sourceUri: string
	allowUpdates?: boolean
	feeNanomina?: number | bigint
	signDeployment: SignTransaction
	signProvisioning: SignTransaction
	waitForInclusion?: (transactionHash: string) => Promise<void>
}

const compilationByNetwork = new Map<
	string,
	Promise<{
		adminVerificationKey: VerificationKey
		tokenVerificationKey: VerificationKey
	}>
>()

const requireEqualPublicKey = (left: PublicKey, right: PublicKey, label: string): void => {
	if (!left.equals(right).toBoolean()) throw new Error(`${label} does not match`)
}

const requireEqualField = (left: Field, right: Field, label: string): void => {
	if (!left.equals(right).toBoolean()) throw new Error(`${label} does not match`)
}

export const validateEthereumTokenDeployment = (
	plan: EthereumTokenDeploymentPlan
): EthereumTokenDeploymentPlan => {
	const config = validateEthereumTokenBridgeConfig(plan.config)
	const registration = {
		...plan.registration,
		assetId: normalizeEthereumAssetId(plan.registration.assetId),
		ethereumTokenAddress: plan.registration.ethereumTokenAddress.toLowerCase()
	}
	if (!registration.registered || !registration.allowed) {
		throw new Error("Solidity ERC20 registration must be registered and allowed")
	}
	if (registration.assetId !== config.assetId) {
		throw new Error("Solidity ERC20 asset ID does not match Zeko configuration")
	}
	if (registration.ethereumTokenAddress !== config.ethereumTokenAddress) {
		throw new Error("Solidity ERC20 token address does not match Zeko configuration")
	}
	requireEqualPublicKey(
		registration.zekoTokenOwnerL2,
		config.tokenOwnerL2,
		"Solidity ERC20 token owner"
	)
	requireEqualField(registration.zekoTokenIdL2, config.tokenIdL2, "Solidity ERC20 token ID")
	if (!Number.isInteger(plan.decimals) || plan.decimals < 0 || plan.decimals > 9) {
		throw new Error("ERC20 decimals must fit the Zeko 0-9 decimal range")
	}
	if (
		registration.zekoDecimals !== plan.decimals ||
		registration.ethereumDecimals !== plan.decimals
	) {
		throw new Error("Ethereum, Solidity, and L2 token decimals must match")
	}
	if (plan.inventory.toBigInt() === 0n) throw new Error("ERC20 L2 inventory must be nonzero")
	if (!plan.inventory.equals(registration.depositCap).toBoolean()) {
		throw new Error("ERC20 L2 inventory must exactly equal the Solidity deposit cap")
	}
	requireEqualField(
		plan.bridgeVerificationKey.hash,
		config.verificationKeyHash,
		"Zeko bridge verification key"
	)
	return { ...plan, config, registration }
}

export const compileEthereumTokenDeployment = async (): Promise<{
	adminVerificationKey: VerificationKey
	tokenVerificationKey: VerificationKey
}> => {
	const network = JSON.stringify(Mina.getNetworkId())
	let compilation = compilationByNetwork.get(network)
	if (!compilation) {
		compilation = (async () => {
			// o1js compilation uses one global analysis context, so these must not overlap.
			const admin = await FungibleTokenAdmin.compile()
			const token = await FungibleToken.compile()
			return {
				adminVerificationKey: admin.verificationKey,
				tokenVerificationKey: token.verificationKey
			}
		})()
		compilationByNetwork.set(network, compilation)
	}
	return await compilation
}

const proveSignAndSend = async (
	transaction: Awaited<ReturnType<typeof Mina.transaction>>,
	sign: SignTransaction,
	waitForInclusion?: (transactionHash: string) => Promise<void>
): Promise<string> => {
	const proved = await transaction.prove()
	const signed = await sign(proved)
	const pending = await signed.send()
	if (waitForInclusion) await waitForInclusion(pending.hash)
	else await pending.wait()
	return pending.hash
}

const assertInstalledAccount = async (
	plan: EthereumTokenDeploymentPlan,
	adminContractL2: PublicKey,
	inventory: UInt64,
	standard: {
		adminVerificationKey: VerificationKey
		tokenVerificationKey: VerificationKey
	}
): Promise<void> => {
	await Promise.all([
		refreshCache(plan.config.tokenOwnerL2),
		refreshCache(adminContractL2),
		refreshCache(plan.config.holderAccountL2, plan.config.tokenIdL2)
	])
	const vault = Mina.getAccount(plan.config.holderAccountL2, plan.config.tokenIdL2)
	const owner = Mina.getAccount(plan.config.tokenOwnerL2)
	const admin = Mina.getAccount(adminContractL2)
	if (
		!owner.zkapp?.verificationKey?.hash ||
		!Field(owner.zkapp.verificationKey.hash).equals(standard.tokenVerificationKey.hash).toBoolean()
	) {
		throw new Error("Installed ERC20 token owner is not the standard FungibleToken contract")
	}
	if (
		!admin.zkapp?.verificationKey?.hash ||
		!Field(admin.zkapp.verificationKey.hash).equals(standard.adminVerificationKey.hash).toBoolean()
	) {
		throw new Error("Installed ERC20 admin is not the standard FungibleTokenAdmin contract")
	}
	if (vault.balance.toBigInt() !== inventory.toBigInt()) {
		throw new Error("Installed ERC20 vault inventory does not match the deployment plan")
	}
	const installedHash = vault.zkapp?.verificationKey?.hash
	if (!installedHash || !Field(installedHash).equals(plan.config.verificationKeyHash).toBoolean()) {
		throw new Error("Installed ERC20 vault verification key does not match Zeko")
	}
}

const assertFrozenAdmin = async (
	plan: EthereumTokenDeploymentPlan,
	finalAdminContractL2: PublicKey,
	standard: {
		adminVerificationKey: VerificationKey
	}
): Promise<void> => {
	await Promise.all([refreshCache(plan.config.tokenOwnerL2), refreshCache(finalAdminContractL2)])
	const finalAdmin = Mina.getAccount(finalAdminContractL2)
	if (
		!finalAdmin.zkapp?.verificationKey?.hash ||
		!Field(finalAdmin.zkapp.verificationKey.hash)
			.equals(standard.adminVerificationKey.hash)
			.toBoolean()
	) {
		throw new Error("Frozen ERC20 admin is not the standard FungibleTokenAdmin contract")
	}
	const [authorityX, authorityOdd] = finalAdmin.zkapp.appState
	if (!authorityX || !authorityOdd) {
		throw new Error("Frozen ERC20 admin authority state is missing")
	}
	const authority = PublicKey.fromFields([Field(authorityX), Field(authorityOdd)])
	if (!authority.equals(PublicKey.empty()).toBoolean()) {
		throw new Error("Frozen ERC20 admin authority is not PublicKey.empty")
	}
	const installedAdmin = await new FungibleToken(plan.config.tokenOwnerL2).admin.fetch()
	if (!installedAdmin || !installedAdmin.equals(finalAdminContractL2).toBoolean()) {
		throw new Error("ERC20 token owner did not rotate to the frozen final admin")
	}
}

export const deployEthereumTokenMirror = async (
	input: DeployEthereumTokenMirrorInput
): Promise<EthereumTokenDeploymentManifest> => {
	const plan = validateEthereumTokenDeployment(input)
	if (
		input.finalAdminContractL2.equals(input.adminContractL2).toBoolean() ||
		input.finalAdminContractL2.equals(plan.config.tokenOwnerL2).toBoolean() ||
		input.finalAdminContractL2.equals(plan.config.holderAccountL2).toBoolean()
	) {
		throw new Error("Frozen ERC20 admin must use a distinct account")
	}
	const standard = await compileEthereumTokenDeployment()
	const fee = UInt64.from(input.feeNanomina ?? 1_000_000_000)
	const token = new FungibleToken(plan.config.tokenOwnerL2)
	const admin = new FungibleTokenAdmin(input.adminContractL2)
	const finalAdmin = new FungibleTokenAdmin(input.finalAdminContractL2)

	const deployment = await Mina.transaction({ sender: input.feePayer, fee }, async () => {
		AccountUpdate.fundNewAccount(input.feePayer, 3)
		await admin.deploy({ adminPublicKey: input.adminAuthorityL2 })
		await token.deploy({
			symbol: input.symbol,
			src: input.sourceUri,
			allowUpdates: input.allowUpdates ?? false
		})
		await token.initialize(input.adminContractL2, UInt8.from(plan.decimals), Bool(false))
	})
	const deploymentTransactionHash = await proveSignAndSend(
		deployment,
		input.signDeployment,
		input.waitForInclusion
	)
	await Promise.all([refreshCache(plan.config.tokenOwnerL2), refreshCache(input.adminContractL2)])

	// Build the signed custom-token update outside the transaction so it is only
	// attached beneath the standard token owner's approveBase call.
	const vault = AccountUpdate.createSigned(plan.config.holderAccountL2, plan.config.tokenIdL2)
	vault.account.verificationKey.set(plan.bridgeVerificationKey)
	vault.account.permissions.set({
		...Permissions.default(),
		send: Permissions.proof(),
		setVerificationKey: Permissions.VerificationKey.impossibleDuringCurrentVersion(),
		setPermissions: Permissions.impossible()
	})
	const vaultInstallation = await Mina.transaction({ sender: input.feePayer, fee }, async () => {
		AccountUpdate.fundNewAccount(input.feePayer, 1)
		await token.approveBase(AccountUpdateForest.fromFlatArray([vault]))
	})
	const vaultInstallationTransactionHash = await proveSignAndSend(
		vaultInstallation,
		input.signProvisioning,
		input.waitForInclusion
	)
	await Promise.all([
		refreshCache(plan.config.tokenOwnerL2),
		refreshCache(plan.config.tokenOwnerL2, plan.config.tokenIdL2),
		refreshCache(input.adminContractL2),
		refreshCache(plan.config.holderAccountL2, plan.config.tokenIdL2)
	])
	if (!Mina.hasAccount(plan.config.holderAccountL2, plan.config.tokenIdL2)) {
		throw new Error("ERC20 bridge vault account was not installed")
	}
	if (!Mina.hasAccount(plan.config.tokenOwnerL2, plan.config.tokenIdL2)) {
		throw new Error("ERC20 circulation account was not initialized")
	}

	const inventoryMint = await Mina.transaction({ sender: input.feePayer, fee }, async () => {
		// The first standard mint materializes its token-balance bookkeeping account.
		AccountUpdate.fundNewAccount(input.feePayer, 1)
		await token.mint(plan.config.holderAccountL2, plan.inventory)
	})
	const inventoryMintTransactionHash = await proveSignAndSend(
		inventoryMint,
		input.signProvisioning,
		input.waitForInclusion
	)
	await assertInstalledAccount(plan, input.adminContractL2, plan.inventory, standard)

	const adminRotation = await Mina.transaction({ sender: input.feePayer, fee }, async () => {
		AccountUpdate.fundNewAccount(input.feePayer, 1)
		await finalAdmin.deploy({ adminPublicKey: PublicKey.empty() })
		await token.setAdmin(input.finalAdminContractL2)
	})
	const adminRotationTransactionHash = await proveSignAndSend(
		adminRotation,
		input.signProvisioning,
		input.waitForInclusion
	)
	await assertFrozenAdmin(plan, input.finalAdminContractL2, standard)

	return {
		assetId: plan.config.assetId,
		ethereumTokenAddress: plan.config.ethereumTokenAddress,
		tokenOwnerL2: plan.config.tokenOwnerL2.toBase58(),
		tokenIdL2: TokenId.toBase58(plan.config.tokenIdL2),
		adminContractL2: input.adminContractL2.toBase58(),
		adminAuthorityL2: input.adminAuthorityL2.toBase58(),
		finalAdminContractL2: input.finalAdminContractL2.toBase58(),
		finalAdminAuthorityL2: PublicKey.empty().toBase58(),
		holderAccountL2: plan.config.holderAccountL2.toBase58(),
		bridgeVerificationKeyHash: plan.config.verificationKeyHash.toString(),
		decimals: plan.decimals,
		inventory: plan.inventory.toString(),
		deploymentTransactionHash,
		vaultInstallationTransactionHash,
		inventoryMintTransactionHash,
		adminRotationTransactionHash
	}
}
