import { Field, Poseidon, TokenId } from "o1js"
import type { Deposit, EthereumTokenBridgeConfig, Withdrawal } from "./types"

const ETHEREUM_ADDRESS = /^0x[0-9a-f]{40}$/
const ZERO_ETHEREUM_ADDRESS = `0x${"0".repeat(40)}`

export function ethereumDepositAux(deposit: Deposit): Field {
	const assetFields = deposit.assetId ? splitEthereumAssetId(deposit.assetId) : []
	const registryFields = ethereumAssetActionRegistryFields(deposit)
	return Poseidon.hashWithPrefix(
		registryFields
			? "Ethereum ERC20 deposit V2"
			: deposit.assetId
				? "Ethereum ERC20 deposit V1"
				: "Ethereum deposit V1",
		[
			...(registryFields ?? []),
			...assetFields,
			Field(0), // Empty children
			...deposit.holderAccountL1.toFields(),
			...deposit.amount.toFields(),
			...deposit.recipient.toFields(),
			...deposit.timeout.toFields()
		]
	)
}

type EthereumAssetActionIdentity = {
	readonly assetId: string
	readonly encodingVersion?: 2
	readonly registryIndex?: number
	readonly recordCommitment?: Field
}

const ethereumAssetActionRegistryFields = (
	action: Partial<EthereumAssetActionIdentity>
): readonly [Field, Field, Field] | null => {
	const hasRegistryMetadata =
		action.encodingVersion !== undefined ||
		action.registryIndex !== undefined ||
		action.recordCommitment !== undefined
	if (!hasRegistryMetadata) return null
	if (!action.assetId) {
		throw new Error("Ethereum ERC20 V2 action metadata requires an asset ID")
	}
	if (
		action.encodingVersion !== 2 ||
		action.registryIndex === undefined ||
		action.recordCommitment === undefined
	) {
		throw new Error(
			"Ethereum ERC20 V2 action metadata requires encoding version, registry index, and record commitment"
		)
	}
	if (
		!Number.isSafeInteger(action.registryIndex) ||
		action.registryIndex < 0 ||
		action.registryIndex >= 1 << 8
	) {
		throw new Error("Ethereum ERC20 registry index is outside its depth-8 range")
	}
	return [Field(2), Field(action.registryIndex), action.recordCommitment]
}

export type EthereumTokenWithdrawalAction = Withdrawal & EthereumAssetActionIdentity

export function ethereumTokenWithdrawalAux(withdrawal: EthereumTokenWithdrawalAction): Field {
	const registryFields = ethereumAssetActionRegistryFields(withdrawal)
	const assetFields = splitEthereumAssetId(withdrawal.assetId)
	return Poseidon.hashWithPrefix(
		registryFields ? "Ethereum ERC20 withdrawal V2" : "Ethereum ERC20 withdrawal V1",
		[
			...(registryFields ?? []),
			...assetFields,
			Field(0), // Empty children
			...withdrawal.amount.toFields(),
			...withdrawal.recipient.toFields()
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
