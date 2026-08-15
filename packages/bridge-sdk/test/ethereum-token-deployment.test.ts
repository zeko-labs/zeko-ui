import { FungibleToken } from "mina-fungible-token"
import {
	AccountUpdate,
	AccountUpdateForest,
	Field,
	Mina,
	method,
	PrivateKey,
	PublicKey,
	SmartContract,
	TokenId,
	UInt64,
	type VerificationKey
} from "o1js"
import { describe, expect, it, vi } from "vitest"
import {
	deployEthereumTokenMirror,
	type EthereumTokenDeploymentPlan,
	validateEthereumTokenDeployment
} from "../src/ethereum-token-deployment"
import * as utils from "../src/utils"

class TestBridgeVault extends SmartContract {
	@method.returns(AccountUpdate)
	async release(recipient: PublicKey, amount: UInt64): Promise<AccountUpdate> {
		this.balance.subInPlace(amount)
		this.self.body.mayUseToken = {
			parentsOwnToken: Field(1).equals(1),
			inheritFromParent: Field(0).equals(1)
		}
		const payout = AccountUpdate.create(recipient, this.tokenId)
		payout.balance.addInPlace(amount)
		payout.body.mayUseToken = {
			parentsOwnToken: Field(0).equals(1),
			inheritFromParent: Field(1).equals(1)
		}
		this.approve(payout)
		return this.self
	}

	@method.returns(AccountUpdate)
	async receive(amount: UInt64): Promise<AccountUpdate> {
		this.balance.addInPlace(amount)
		this.self.body.mayUseToken = {
			parentsOwnToken: Field(1).equals(1),
			inheritFromParent: Field(0).equals(1)
		}
		return this.self
	}
}

const validationPlan = (): EthereumTokenDeploymentPlan => {
	const tokenOwnerL2 = PrivateKey.random().toPublicKey()
	const holderAccountL2 = PrivateKey.random().toPublicKey()
	const tokenIdL2 = TokenId.derive(tokenOwnerL2)
	const assetId = `0x${"44".repeat(32)}`
	const ethereumTokenAddress = `0x${"12".repeat(20)}`
	const bridgeVerificationKey = { data: "test-vk", hash: Field(99) } as VerificationKey
	return {
		config: {
			assetId,
			ethereumTokenAddress,
			tokenOwnerL2,
			tokenIdL2,
			holderAccountL2,
			verificationKeyHash: bridgeVerificationKey.hash
		},
		registration: {
			registered: true,
			allowed: true,
			assetId,
			ethereumTokenAddress,
			zekoTokenOwnerL2: tokenOwnerL2,
			zekoTokenIdL2: tokenIdL2,
			zekoDecimals: 9,
			ethereumDecimals: 9,
			depositCap: UInt64.from(1_000)
		},
		bridgeVerificationKey,
		decimals: 9,
		inventory: UInt64.from(1_000)
	}
}

describe("ERC20 mirror token deployment validation", () => {
	it("accepts a registration whose cap exactly backs the L2 inventory", () => {
		expect(validateEthereumTokenDeployment(validationPlan()).inventory.toBigInt()).toBe(1_000n)
	})

	it("rejects registry, cap, decimals, asset, and bridge VK mismatches", () => {
		const plan = validationPlan()
		expect(() =>
			validateEthereumTokenDeployment({
				...plan,
				registration: { ...plan.registration, registered: false }
			})
		).toThrow("registered and allowed")
		expect(() => validateEthereumTokenDeployment({ ...plan, inventory: UInt64.from(999) })).toThrow(
			"exactly equal"
		)
		expect(() =>
			validateEthereumTokenDeployment({
				...plan,
				registration: { ...plan.registration, ethereumDecimals: 18 }
			})
		).toThrow("decimals must match")
		expect(() =>
			validateEthereumTokenDeployment({
				...plan,
				decimals: 10,
				registration: { ...plan.registration, zekoDecimals: 10, ethereumDecimals: 10 }
			})
		).toThrow("0-9 decimal range")
		expect(() =>
			validateEthereumTokenDeployment({
				...plan,
				registration: { ...plan.registration, assetId: `0x${"55".repeat(32)}` }
			})
		).toThrow("asset ID")
		expect(() =>
			validateEthereumTokenDeployment({
				...plan,
				bridgeVerificationKey: { ...plan.bridgeVerificationKey, hash: Field(100) }
			})
		).toThrow("verification key")
	})
})

describe("ERC20 mirror token local roundtrip", () => {
	it("deploys the standard token, locks its funded vault to the bridge VK, and moves tokens both ways", async () => {
		const refreshCache = vi.spyOn(utils, "refreshCache")
		const local = await Mina.LocalBlockchain({
			proofsEnabled: false,
			enforceTransactionLimits: false
		})
		Mina.setActiveInstance(local)
		const [feePayer] = local.testAccounts
		const ownerKey = PrivateKey.random()
		const adminContractKey = PrivateKey.random()
		const adminAuthorityKey = PrivateKey.random()
		const finalAdminContractKey = PrivateKey.random()
		const vaultKey = PrivateKey.random()
		const userKey = PrivateKey.random()
		const tokenId = TokenId.derive(ownerKey.toPublicKey())
		const { verificationKey } = await TestBridgeVault.compile()
		const inventory = UInt64.from(1_000)
		const inclusionHashes: string[] = []
		const plan: EthereumTokenDeploymentPlan = {
			config: {
				assetId: `0x${"44".repeat(32)}`,
				ethereumTokenAddress: `0x${"12".repeat(20)}`,
				tokenOwnerL2: ownerKey.toPublicKey(),
				tokenIdL2: tokenId,
				holderAccountL2: vaultKey.toPublicKey(),
				verificationKeyHash: verificationKey.hash
			},
			registration: {
				registered: true,
				allowed: true,
				assetId: `0x${"44".repeat(32)}`,
				ethereumTokenAddress: `0x${"12".repeat(20)}`,
				zekoTokenOwnerL2: ownerKey.toPublicKey(),
				zekoTokenIdL2: tokenId,
				zekoDecimals: 9,
				ethereumDecimals: 9,
				depositCap: inventory
			},
			bridgeVerificationKey: verificationKey,
			decimals: 9,
			inventory
		}

		const manifest = await deployEthereumTokenMirror({
			...plan,
			feePayer,
			adminContractL2: adminContractKey.toPublicKey(),
			adminAuthorityL2: adminAuthorityKey.toPublicKey(),
			finalAdminContractL2: finalAdminContractKey.toPublicKey(),
			symbol: "zERC",
			sourceUri: "https://example.invalid/zeko-erc20",
			signDeployment: async (transaction) =>
				transaction.sign([feePayer.key, ownerKey, adminContractKey]),
			signProvisioning: async (transaction) =>
				transaction.sign([feePayer.key, adminAuthorityKey, finalAdminContractKey, vaultKey]),
			waitForInclusion: async (transactionHash) => {
				inclusionHashes.push(transactionHash)
			}
		})

		expect(manifest.inventory).toBe("1000")
		expect(inclusionHashes).toEqual([
			manifest.deploymentTransactionHash,
			manifest.vaultInstallationTransactionHash,
			manifest.inventoryMintTransactionHash,
			manifest.adminRotationTransactionHash
		])
		expect(manifest.finalAdminContractL2).toBe(finalAdminContractKey.toPublicKey().toBase58())
		expect(manifest.finalAdminAuthorityL2).toBe(PublicKey.empty().toBase58())
		expect(refreshCache).toHaveBeenCalledWith(ownerKey.toPublicKey(), tokenId)
		expect(
			refreshCache.mock.calls.filter(
				([publicKey, token]) => publicKey === feePayer && token === undefined
			)
		).toHaveLength(4)
		expect(
			refreshCache.mock.calls.filter(
				([publicKey, token]) =>
					publicKey instanceof PublicKey &&
					publicKey.equals(adminAuthorityKey.toPublicKey()).toBoolean() &&
					token === undefined
			)
		).toHaveLength(2)
		refreshCache.mockRestore()
		expect(Mina.getBalance(vaultKey.toPublicKey(), tokenId).toBigInt()).toBe(1_000n)
		expect(
			Mina.getAccount(vaultKey.toPublicKey(), tokenId).zkapp?.verificationKey?.hash.toString()
		).toBe(verificationKey.hash.toString())

		const token = new FungibleToken(ownerKey.toPublicKey())
		const vault = new TestBridgeVault(vaultKey.toPublicKey(), tokenId)
		const amount = UInt64.from(125)
		const deposit = await Mina.transaction(feePayer, async () => {
			AccountUpdate.fundNewAccount(feePayer, 1)
			const release = await vault.release(userKey.toPublicKey(), amount)
			await token.approveBase(AccountUpdateForest.fromReverse([release.extractTree()]))
		})
		await deposit.prove()
		await deposit
			.sign([feePayer.key])
			.send()
			.then((pending) => pending.wait())
		expect(Mina.getBalance(userKey.toPublicKey(), tokenId).toBigInt()).toBe(125n)
		expect(Mina.getBalance(vaultKey.toPublicKey(), tokenId).toBigInt()).toBe(875n)

		const debit = AccountUpdate.default(userKey.toPublicKey(), tokenId)
		debit.requireSignature()
		debit.balance.subInPlace(amount)
		debit.body.mayUseToken = {
			parentsOwnToken: Field(1).equals(1),
			inheritFromParent: Field(0).equals(1)
		}
		const receive = await vault.receive(amount)
		const withdrawal = await Mina.transaction(feePayer, async () => {
			await token.approveBase(AccountUpdateForest.fromFlatArray([debit, receive]))
		})
		await withdrawal.prove()
		await withdrawal
			.sign([feePayer.key, userKey])
			.send()
			.then((pending) => pending.wait())
		expect(Mina.getBalance(userKey.toPublicKey(), tokenId).toBigInt()).toBe(0n)
		expect(Mina.getBalance(vaultKey.toPublicKey(), tokenId).toBigInt()).toBe(1_000n)
	}, 180_000)
})
