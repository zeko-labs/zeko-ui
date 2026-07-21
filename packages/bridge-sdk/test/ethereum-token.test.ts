import { AccountUpdate, Bool, Field, Int64, PrivateKey, TokenId, UInt64 } from "o1js"
import { describe, expect, it } from "vitest"
import {
	assertMatchingFungibleTokenOwner,
	graftEthereumTokenDepositHelperSignature,
	parseProvedAccountUpdates,
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
		const template = [templateOwner, templateDebit, templateVault]

		const inner = AccountUpdate.default(key())
		const provedOwner = AccountUpdate.clone(templateOwner)
		provedOwner.body.callDepth = 1
		const provedDebit = AccountUpdate.clone(templateDebit)
		provedDebit.body.callDepth = 2
		const provedVault = AccountUpdate.clone(templateVault)
		provedVault.body.callDepth = 2

		expect(() =>
			assertMatchingFungibleTokenOwner(templateOwner, template, provedOwner, [
				inner,
				provedOwner,
				provedDebit,
				provedVault
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
