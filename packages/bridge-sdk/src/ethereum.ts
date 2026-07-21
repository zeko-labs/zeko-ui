import { Field, Poseidon, TokenId } from "o1js"
import type { Deposit, EthereumTokenBridgeConfig } from "./types"

const ETHEREUM_ADDRESS = /^0x[0-9a-f]{40}$/
const ZERO_ETHEREUM_ADDRESS = `0x${"0".repeat(40)}`

export function ethereumDepositAux(deposit: Deposit): Field {
	const assetFields = deposit.assetId ? splitEthereumAssetId(deposit.assetId) : []
	return Poseidon.hashWithPrefix(
		deposit.assetId ? "Ethereum ERC20 deposit V1" : "Ethereum deposit V1",
		[
			...assetFields,
			Field(0), // Empty children
			...deposit.holderAccountL1.toFields(),
			...deposit.amount.toFields(),
			...deposit.recipient.toFields(),
			...deposit.timeout.toFields()
		]
	)
}

const CANONICAL_ASSET_ID = /^0x[0-9a-f]{64}$/
const ZERO_ASSET_ID = `0x${"0".repeat(64)}`

export function normalizeEthereumAssetId(assetId: string): string {
	const normalized = assetId.toLowerCase()
	if (!CANONICAL_ASSET_ID.test(normalized) || normalized === ZERO_ASSET_ID) {
		throw new Error("Ethereum ERC20 asset ID must be a nonzero canonical bytes32 value")
	}
	return normalized
}

export function splitEthereumAssetId(assetId: string): [Field, Field] {
	const normalized = normalizeEthereumAssetId(assetId)
	return [Field(BigInt(`0x${normalized.slice(2, 34)}`)), Field(BigInt(`0x${normalized.slice(34)}`))]
}

export const validateEthereumTokenBridgeConfig = (
	config: EthereumTokenBridgeConfig
): EthereumTokenBridgeConfig => {
	const assetId = normalizeEthereumAssetId(config.assetId)
	const ethereumTokenAddress = config.ethereumTokenAddress.toLowerCase()
	if (
		!ETHEREUM_ADDRESS.test(ethereumTokenAddress) ||
		ethereumTokenAddress === ZERO_ETHEREUM_ADDRESS
	) {
		throw new Error("Ethereum ERC20 token address must be a nonzero canonical address")
	}
	const expectedTokenId = TokenId.derive(config.tokenOwnerL2)
	if (!expectedTokenId.equals(config.tokenIdL2).toBoolean()) {
		throw new Error("Configured ERC20 L2 token ID does not derive from its token owner")
	}
	if (config.tokenOwnerL2.equals(config.holderAccountL2).toBoolean()) {
		throw new Error("ERC20 token owner and bridge vault must be different accounts")
	}
	return { ...config, assetId, ethereumTokenAddress }
}
