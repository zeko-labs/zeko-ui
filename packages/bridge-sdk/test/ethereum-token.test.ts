import {
	AccountUpdate,
	Bool,
	Field,
	Int64,
	Mina,
	Poseidon,
	PrivateKey,
	TokenId,
	UInt32,
	UInt64
} from "o1js"
import { describe, expect, it } from "vitest"
import {
	ethereumDepositAux,
	ethereumTokenWithdrawalAux,
	splitEthereumAssetId
} from "../src/ethereum"
import { ethereumAssetBridgeCallData, ethereumAssetRecordCommitment } from "../src/ethereum-assets"
import {
	assertMatchingFungibleTokenOwner,
	buildEthereumTokenWithdrawalApproval,
	countMissingEthereumTokenAccounts,
	ethereumAssetProofBinding,
	graftEthereumTokenDepositHelperSignature,
	parseProvedAccountUpdates,
	resolveEthereumTokenAsset,
	resolveEthereumTokenDepositAsset,
	validateAndGraftEthereumAssetRegistrationAuthority,
	validateEthereumTokenBridgeConfig,
	validateEthereumTokenDepositForest
} from "../src/ethereum-token"

const key = () => PrivateKey.random().toPublicKey()

const config = () => {
	const tokenOwnerL2 = key()
	return {
		assetId: `0x${"44".repeat(32)}`,
		ethereumTokenAddress: `0x${"12".repeat(20)}`,
		tokenOwnerL2,
		tokenIdL2: TokenId.derive(tokenOwnerL2),
		holderAccountL2: key(),
		verificationKeyHash: Field(99)
	}
}

const proofAuthorize = (update: AccountUpdate, verificationKeyHash: Field) => {
	update.body.authorizationKind = {
		isSigned: Bool(false),
		isProved: Bool(true),
		verificationKeyHash
	}
	update.authorization.proof = "proof"
}

describe("Ethereum token bridge configuration", () => {
	it("accepts an immutable asset whose token ID derives from its owner", () => {
		expect(validateEthereumTokenBridgeConfig(config()).assetId).toBe(`0x${"44".repeat(32)}`)
	})

	it("rejects a wrong asset ID, token owner derivation, and zero Ethereum token", () => {
		expect(() => validateEthereumTokenBridgeConfig({ ...config(), assetId: "0x44" })).toThrow(
			"canonical bytes32"
		)
		expect(() =>
			validateEthereumTokenBridgeConfig({ ...config(), assetId: `0x${"0".repeat(64)}` })
		).toThrow("nonzero canonical")
		expect(() => validateEthereumTokenBridgeConfig({ ...config(), tokenIdL2: Field(7) })).toThrow(
			"does not derive"
		)
		expect(() =>
			validateEthereumTokenBridgeConfig({
				...config(),
				ethereumTokenAddress: `0x${"0".repeat(40)}`
			})
		).toThrow("nonzero canonical")
	})

	it("routes a legacy runtime without consulting the universal registry", async () => {
		const legacy = config()
		const resolved = await resolveEthereumTokenAsset(
			{
				ethereumAssets: null,
				ethereumToken: legacy
			} as never,
			{ ethereumTokenAddress: legacy.ethereumTokenAddress }
		)

		expect(resolved).toMatchObject({ encodingVersion: 1, config: legacy })
	})

	it("routes dual-runtime deposits only from immutable action encoding metadata", async () => {
		const legacy = config()
		const runtime = {
			ethereumAssets: {},
			ethereumToken: legacy
		} as never

		await expect(
			resolveEthereumTokenDepositAsset(runtime, {
				encodingVersion: 1,
				asset: { ethereumTokenAddress: legacy.ethereumTokenAddress }
			})
		).resolves.toMatchObject({ encodingVersion: 1, config: legacy })
		await expect(
			resolveEthereumTokenDepositAsset(runtime, {
				ethereumTokenAddress: legacy.ethereumTokenAddress
			})
		).rejects.toThrow(/encoding metadata/i)
	})
})

describe("versioned Ethereum token actions", () => {
	it("serializes one shared V2 proof binding for deposits and withdrawals", () => {
		const bridge = config()
		const record = {
			schemaVersion: 1,
			registryIndex: 7,
			assetId: bridge.assetId,
			ethereumTokenAddress: bridge.ethereumTokenAddress,
			tokenOwnerL2: bridge.tokenOwnerL2,
			tokenIdL2: bridge.tokenIdL2,
			decimals: 9,
			inventoryCap: UInt64.from(1000),
			mftStandardVkId: Field(77),
			vaultPublicKey: bridge.holderAccountL2,
			universalBridgeVkId: Field(78)
		}
		const witnessJson = '{"root":"123"}'

		expect(ethereumAssetProofBinding()).toEqual({ params: {} })
		expect(ethereumAssetProofBinding({ record, witnessJson })).toEqual({
			asset: witnessJson,
			params: {
				encodingVersion: "2",
				registryIndex: "7",
				recordCommitment: ethereumAssetRecordCommitment(record).toString()
			}
		})
	})

	it("binds the V2 encoding version, registry index, record commitment, and asset ID", () => {
		const bridge = config()
		const recipient = key()
		const holderAccountL1 = key()
		const amount = UInt64.from(25)
		const timeout = UInt32.from(30)
		const record = {
			schemaVersion: 1,
			registryIndex: 7,
			assetId: bridge.assetId,
			ethereumTokenAddress: bridge.ethereumTokenAddress,
			tokenOwnerL2: bridge.tokenOwnerL2,
			tokenIdL2: bridge.tokenIdL2,
			decimals: 9,
			inventoryCap: UInt64.from(1000),
			mftStandardVkId: Field(77),
			vaultPublicKey: bridge.holderAccountL2,
			universalBridgeVkId: Field(78)
		}
		const recordCommitment = ethereumAssetRecordCommitment(record)
		const deposit = {
			encodingVersion: 2 as const,
			registryIndex: record.registryIndex,
			recordCommitment,
			assetId: record.assetId,
			holderAccountL1,
			amount,
			recipient,
			timeout
		}
		const withdrawal = {
			encodingVersion: 2 as const,
			registryIndex: record.registryIndex,
			recordCommitment,
			assetId: record.assetId,
			amount,
			recipient
		}
		const [assetIdHigh, assetIdLow] = splitEthereumAssetId(record.assetId)
		const expectedDeposit = Poseidon.hashWithPrefix("Ethereum ERC20 deposit V2", [
			Field(2),
			Field(record.registryIndex),
			recordCommitment,
			assetIdHigh,
			assetIdLow,
			Field(0),
			...holderAccountL1.toFields(),
			...amount.toFields(),
			...recipient.toFields(),
			...timeout.toFields()
		])
		const expectedWithdrawal = Poseidon.hashWithPrefix("Ethereum ERC20 withdrawal V2", [
			Field(2),
			Field(record.registryIndex),
			recordCommitment,
			assetIdHigh,
			assetIdLow,
			Field(0),
			...amount.toFields(),
			...recipient.toFields()
		])

		expect(ethereumDepositAux(deposit).equals(expectedDeposit).toBoolean()).toBe(true)
		expect(ethereumTokenWithdrawalAux(withdrawal).equals(expectedWithdrawal).toBoolean()).toBe(true)
		expect(
			ethereumDepositAux({ ...deposit, registryIndex: record.registryIndex + 1 })
				.equals(ethereumDepositAux(deposit))
				.toBoolean()
		).toBe(false)
		expect(
			ethereumDepositAux({ ...deposit, recordCommitment: recordCommitment.add(1) })
				.equals(ethereumDepositAux(deposit))
				.toBoolean()
		).toBe(false)
		expect(
			ethereumTokenWithdrawalAux({ ...withdrawal, registryIndex: record.registryIndex + 1 })
				.equals(ethereumTokenWithdrawalAux(withdrawal))
				.toBoolean()
		).toBe(false)
		expect(
			ethereumTokenWithdrawalAux({ ...withdrawal, recordCommitment: recordCommitment.add(1) })
				.equals(ethereumTokenWithdrawalAux(withdrawal))
				.toBoolean()
		).toBe(false)
	})

	it("keeps the asset-only V1 deposit encoding explicit and rejects partial V2 metadata", () => {
		const bridge = config()
		const legacy = {
			assetId: bridge.assetId,
			holderAccountL1: key(),
			amount: UInt64.from(25),
			recipient: key(),
			timeout: UInt32.from(30)
		}

		expect(() => ethereumDepositAux(legacy)).not.toThrow()
		expect(() => ethereumDepositAux({ ...legacy, encodingVersion: 2, registryIndex: 0 })).toThrow(
			/record commitment|metadata/i
		)
		expect(() =>
			ethereumDepositAux({
				...legacy,
				assetId: undefined,
				encodingVersion: 2,
				registryIndex: 0,
				recordCommitment: Field(1)
			})
		).toThrow(/asset ID/i)
	})
})

describe("Ethereum asset registration authority", () => {
	const registrationForest = () => {
		const registryPublicKey = key()
		const registrationAuthority = key()
		const registryVerificationKeyHash = Field(777)
		const registry = AccountUpdate.default(registryPublicKey)
		proofAuthorize(registry, registryVerificationKeyHash)
		const authority = AccountUpdate.default(registrationAuthority)
		authority.body.callDepth = 1
		authority.body.callData = Field(123)
		authority.body.authorizationKind.isSigned = Bool(true)
		authority.body.useFullCommitment = Bool(true)
		return {
			assets: {
				registryPublicKey,
				registrationAuthority,
				registryVerificationKeyHash
			},
			authority,
			registry,
			updates: [registry, authority]
		}
	}

	it("accepts only the configured full-commitment child and grafts its signature", () => {
		const { assets, authority, updates } = registrationForest()

		expect(
			validateAndGraftEthereumAssetRegistrationAuthority(
				updates,
				assets,
				assets.registrationAuthority
			)
		).toEqual({ registry: updates[0], authority })
		expect(authority.lazyAuthorization).toEqual({ kind: "lazy-signature" })
	})

	it("rejects a different fee payer, a mutated authority body, or extra proof children", () => {
		const wrongFeePayer = registrationForest()
		expect(() =>
			validateAndGraftEthereumAssetRegistrationAuthority(
				wrongFeePayer.updates,
				wrongFeePayer.assets,
				key()
			)
		).toThrow(/fee payer.*registration authority/i)

		const mutated = registrationForest()
		mutated.authority.balance.addInPlace(UInt64.from(1))
		expect(() =>
			validateAndGraftEthereumAssetRegistrationAuthority(
				mutated.updates,
				mutated.assets,
				mutated.assets.registrationAuthority
			)
		).toThrow(/authority body/i)

		const extraChild = registrationForest()
		expect(() =>
			validateAndGraftEthereumAssetRegistrationAuthority(
				[...extraChild.updates, AccountUpdate.default(key())],
				extraChild.assets,
				extraChild.assets.registrationAuthority
			)
		).toThrow(/exactly.*authority child/i)
	})
})

describe("proved ERC20 deposit forest", () => {
	it("grafts a lazy signature without changing the proved helper body", () => {
		const helper = AccountUpdate.default(key())
		helper.body.authorizationKind.isSigned = Bool(true)
		const helperHash = helper.hash().toString()

		graftEthereumTokenDepositHelperSignature(helper)

		expect(helper.lazyAuthorization).toEqual({ kind: "lazy-signature" })
		expect(helper.hash().toString()).toBe(helperHash)
	})

	it("rejects a helper whose proved body does not require a signature", () => {
		expect(() => graftEthereumTokenDepositHelperSignature(AccountUpdate.default(key()))).toThrow(
			"not signature-authorized"
		)
	})

	it("accepts the proved vault and helper shape", () => {
		const bridge = config()
		const recipient = key()
		const amount = UInt64.from(25)
		const vault = AccountUpdate.default(bridge.holderAccountL2, bridge.tokenIdL2)
		vault.balanceChange = Int64.fromUnsigned(amount).neg()
		proofAuthorize(vault, bridge.verificationKeyHash)
		const helper = AccountUpdate.default(
			recipient,
			TokenId.derive(bridge.holderAccountL2, bridge.tokenIdL2)
		)
		helper.body.callDepth = 1

		expect(validateEthereumTokenDepositForest(bridge, recipient, amount, [vault, helper])).toEqual({
			vault,
			helper
		})
	})

	it("rejects a custom-token vault that tries to pay an implicit creation fee", () => {
		const bridge = config()
		const vault = AccountUpdate.default(bridge.holderAccountL2, bridge.tokenIdL2)
		vault.balanceChange = Int64.from(-25)
		vault.body.implicitAccountCreationFee = Bool(true)
		proofAuthorize(vault, bridge.verificationKeyHash)

		expect(() =>
			validateEthereumTokenDepositForest(bridge, key(), UInt64.from(25), [vault])
		).toThrow("implicit account-creation fee")
	})

	it("counts each absent account in the proved forest once", async () => {
		const local = await Mina.LocalBlockchain({ proofsEnabled: false })
		Mina.setActiveInstance(local)
		const existing = local.testAccounts[0]
		const missingNative = key()
		const missingToken = key()
		const customToken = Field(123)

		expect(
			countMissingEthereumTokenAccounts([
				AccountUpdate.default(existing),
				AccountUpdate.default(missingNative),
				AccountUpdate.default(missingNative),
				AccountUpdate.default(missingToken, customToken)
			])
		).toBe(2)
	})

	it("rejects a wrong vault and verification key", () => {
		const bridge = config()
		const recipient = key()
		const amount = UInt64.from(25)
		const wrongVault = AccountUpdate.default(key(), bridge.tokenIdL2)
		wrongVault.balanceChange = Int64.fromUnsigned(amount).neg()
		proofAuthorize(wrongVault, bridge.verificationKeyHash)
		expect(() =>
			validateEthereumTokenDepositForest(bridge, recipient, amount, [wrongVault])
		).toThrow("wrong account")

		const vault = AccountUpdate.default(bridge.holderAccountL2, bridge.tokenIdL2)
		vault.balanceChange = Int64.fromUnsigned(amount).neg()
		proofAuthorize(vault, Field(100))
		expect(() => validateEthereumTokenDepositForest(bridge, recipient, amount, [vault])).toThrow(
			"wrong verification key"
		)
	})
})

describe("FungibleToken owner graft", () => {
	it("binds the registry checkpoint below the synthesized vault receive", () => {
		const bridge = config()
		const registryPublicKey = key()
		const root = Field(1234)
		const record = {
			schemaVersion: 1,
			registryIndex: 0,
			assetId: bridge.assetId,
			ethereumTokenAddress: bridge.ethereumTokenAddress,
			tokenOwnerL2: bridge.tokenOwnerL2,
			tokenIdL2: bridge.tokenIdL2,
			decimals: 9,
			inventoryCap: UInt64.from(1000),
			mftStandardVkId: Field(77),
			vaultPublicKey: bridge.holderAccountL2,
			universalBridgeVkId: Field(78)
		}
		const amount = UInt64.from(10)
		const { debit, vault, registry, updates } = buildEthereumTokenWithdrawalApproval({
			config: bridge,
			membership: {
				root,
				count: 2,
				schemaVersion: 1,
				record
			},
			registryPublicKey,
			sender: key(),
			amount
		})

		expect(updates).toEqual([debit, vault, registry])
		expect(debit.body.callDepth).toBe(0)
		expect(vault.body.callDepth).toBe(0)
		expect(registry.body.callDepth).toBe(1)
		expect(registry.publicKey.equals(registryPublicKey).toBoolean()).toBe(true)
		expect(registry.body.useFullCommitment.toBoolean()).toBe(true)
		expect(registry.body.implicitAccountCreationFee.toBoolean()).toBe(true)
		const state = registry.body.preconditions.account.state
		expect(state[0]?.isSome.toBoolean()).toBe(true)
		expect(state[0]?.value.equals(root).toBoolean()).toBe(true)
		expect(state[1]?.isSome.toBoolean()).toBe(true)
		expect(state[1]?.value.equals(Field(2)).toBoolean()).toBe(true)
		expect(state[2]?.isSome.toBoolean()).toBe(true)
		expect(state[2]?.value.equals(Field(1)).toBoolean()).toBe(true)
		expect(
			vault.body.callData.equals(ethereumAssetBridgeCallData(record, amount)).toBoolean()
		).toBe(true)
	})

	it("accepts the same owner body and debit-first calls under a new parent", () => {
		const bridge = config()
		const sender = key()
		const templateOwner = AccountUpdate.default(bridge.tokenOwnerL2)
		const templateDebit = AccountUpdate.default(sender, bridge.tokenIdL2)
		templateDebit.body.callDepth = 1
		templateDebit.balanceChange = Int64.from(-10)
		const templateVault = AccountUpdate.default(bridge.holderAccountL2, bridge.tokenIdL2)
		templateVault.body.callDepth = 1
		templateVault.balanceChange = Int64.from(10)
		const templateRegistry = AccountUpdate.default(key())
		templateRegistry.body.callDepth = 2
		templateRegistry.body.preconditions.account.state[0] = {
			isSome: Bool(true),
			value: Field(1234)
		}
		const template = [templateOwner, templateDebit, templateVault, templateRegistry]

		const inner = AccountUpdate.default(key())
		const provedOwner = AccountUpdate.clone(templateOwner)
		provedOwner.body.callDepth = 1
		const provedDebit = AccountUpdate.clone(templateDebit)
		provedDebit.body.callDepth = 2
		const provedVault = AccountUpdate.clone(templateVault)
		provedVault.body.callDepth = 2
		const provedRegistry = AccountUpdate.clone(templateRegistry)
		provedRegistry.body.callDepth = 3

		expect(() =>
			assertMatchingFungibleTokenOwner(templateOwner, template, provedOwner, [
				inner,
				provedOwner,
				provedDebit,
				provedVault,
				provedRegistry
			])
		).not.toThrow()
	})

	it("rejects any changed child body digest", () => {
		const bridge = config()
		const templateOwner = AccountUpdate.default(bridge.tokenOwnerL2)
		const debit = AccountUpdate.default(key(), bridge.tokenIdL2)
		debit.body.callDepth = 1
		debit.balanceChange = Int64.from(-10)
		const changedDebit = AccountUpdate.clone(debit)
		changedDebit.body.callDepth = 1
		changedDebit.balanceChange = Int64.from(-11)

		expect(() =>
			assertMatchingFungibleTokenOwner(
				templateOwner,
				[templateOwner, debit],
				AccountUpdate.clone(templateOwner),
				[AccountUpdate.clone(templateOwner), changedDebit]
			)
		).toThrow("does not match Zeko witness")
	})
})

describe("proof forest decoding", () => {
	it("rejects malformed JSON and skipped call depths", () => {
		expect(() => parseProvedAccountUpdates([{ body: {} }])).toThrow(
			"Invalid proved account-update forest"
		)
		const root = AccountUpdate.default(key())
		const skipped = AccountUpdate.default(key())
		skipped.body.callDepth = 2
		expect(() =>
			parseProvedAccountUpdates([AccountUpdate.toJSON(root), AccountUpdate.toJSON(skipped)])
		).toThrow("invalid call depth")
	})
})
