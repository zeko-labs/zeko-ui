import {
	buildEthereumAssetRegistryTree,
	ETHEREUM_ASSET_REGISTRY_CAPACITY,
	ETHEREUM_ASSET_REGISTRY_DEPTH,
	ETHEREUM_ASSET_REGISTRY_SCHEMA_VERSION,
	ethereumAssetRegistryFieldHex,
	parseEthereumAssetRegistryField,
	verifyEthereumAssetRegistryMembership
} from "@zeko-labs/bridge-sdk"
import { Field } from "o1js"

type Hex = `0x${string}`
type Address = `0x${string}`
export type RegistryFinalityStatus = "pending" | "canonical"

const U32_MAX = (1n << 32n) - 1n
const U64_MAX = (1n << 64n) - 1n
const U128_MAX = (1n << 128n) - 1n
const U160_MAX = (1n << 160n) - 1n
const COMPRESSED_KEY_ODD_BIT = 1n << 255n

export type RegistryArchiveEvent = {
	fields: string[]
	blockHeight: number
	timestamp: Date
	txnHash: string
	finalityStatus: RegistryFinalityStatus
}

export type IndexedEthereumAssetRecord = {
	schemaVersion: number
	registryIndex: number
	assetId: Hex
	ethereumTokenAddress: Address
	tokenOwnerL2: Hex
	tokenIdL2: Hex
	decimals: number
	inventoryCap: bigint
	mftStandardVkId: Hex
	vaultPublicKey: Hex
	universalBridgeVkId: Hex
	blockHeight: number
	timestamp: Date
	txnHash: string
	finalityStatus: RegistryFinalityStatus
}

export type IndexedEthereumAssetEntry = {
	record: IndexedEthereumAssetRecord
	path: Hex[]
}

export type IndexedEthereumAssetRegistrySnapshot = {
	schemaVersion: number
	depth: number
	root: Hex
	count: number
	finalityStatus: RegistryFinalityStatus
	records: IndexedEthereumAssetEntry[]
}

export type RegistryAssetLookup =
	| { index: number }
	| { assetId: Hex }
	| { ethereumTokenAddress: Address }

const parseUnsigned = (value: string, label: string, max: bigint = Field.ORDER - 1n): bigint => {
	let parsed: bigint
	try {
		parsed = BigInt(value)
	} catch {
		throw new Error(`${label} is not an integer field`)
	}
	if (parsed < 0n || parsed > max) throw new Error(`${label} exceeds its field range`)
	return parsed
}

const parseBoolean = (value: string, label: string): boolean => {
	const parsed = parseUnsigned(value, label, 1n)
	return parsed === 1n
}

const toHex = (value: bigint, bytes = 32): Hex =>
	`0x${value.toString(16).padStart(bytes * 2, "0")}` as Hex

const normalizeEthereumAddress = (value: string): Address => {
	if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
		throw new Error("Ethereum token address must be a 20-byte hex value")
	}
	return value.toLowerCase() as Address
}

const fieldHex = (value: Field): Hex => ethereumAssetRegistryFieldHex(value) as Hex

const packPublicKey = (x: bigint, isOdd: boolean): Hex =>
	toHex(x | (isOdd ? COMPRESSED_KEY_ODD_BIT : 0n))

const parseEvent = (
	event: RegistryArchiveEvent,
	expectedIndex: number
): IndexedEthereumAssetRecord => {
	if (event.fields.length !== 14) {
		throw new Error(`Registry event must contain exactly 14 fields, got ${event.fields.length}`)
	}
	const [
		schema,
		index,
		assetHigh,
		assetLow,
		token,
		ownerX,
		ownerIsOdd,
		tokenId,
		decimals,
		inventoryCap,
		mftVk,
		vaultX,
		vaultIsOdd,
		bridgeVk
	] = event.fields
	const schemaVersion = Number(parseUnsigned(schema, "Schema version", U32_MAX))
	const registryIndex = Number(parseUnsigned(index, "Registry index", U32_MAX))
	if (schemaVersion !== ETHEREUM_ASSET_REGISTRY_SCHEMA_VERSION) {
		throw new Error(`Unsupported registry schema version ${schemaVersion}`)
	}
	if (registryIndex !== expectedIndex || registryIndex >= ETHEREUM_ASSET_REGISTRY_CAPACITY) {
		throw new Error(
			`Registry is not a dense append-only list: expected index ${expectedIndex}, got ${registryIndex}`
		)
	}
	const high = parseUnsigned(assetHigh, "Asset ID high limb", U128_MAX)
	const low = parseUnsigned(assetLow, "Asset ID low limb", U128_MAX)
	const tokenValue = parseUnsigned(token, "Ethereum token address (160 bits)", U160_MAX)
	const ownerXValue = parseUnsigned(ownerX, "L2 token owner")
	const ownerOddValue = parseBoolean(ownerIsOdd, "L2 token owner parity")
	const tokenIdValue = parseUnsigned(tokenId, "L2 token ID")
	const decimalsValue = parseUnsigned(decimals, "Token decimals", 9n)
	const capValue = parseUnsigned(inventoryCap, "Inventory cap", U64_MAX)
	const mftVkValue = parseUnsigned(mftVk, "MFT standard VK")
	const vaultXValue = parseUnsigned(vaultX, "Shared vault public key")
	const vaultOddValue = parseBoolean(vaultIsOdd, "Shared vault parity")
	const bridgeVkValue = parseUnsigned(bridgeVk, "Universal bridge VK")
	const assetId = (high << 128n) | low
	const packedOwner = packPublicKey(ownerXValue, ownerOddValue)
	const packedVault = packPublicKey(vaultXValue, vaultOddValue)
	if (
		assetId === 0n ||
		tokenValue === 0n ||
		BigInt(packedOwner) === 0n ||
		tokenIdValue === 0n ||
		capValue === 0n ||
		mftVkValue === 0n ||
		BigInt(packedVault) === 0n ||
		bridgeVkValue === 0n ||
		packedOwner === packedVault
	) {
		throw new Error("Registry event contains an invalid zero or shared identity")
	}
	return {
		schemaVersion,
		registryIndex,
		assetId: toHex(assetId),
		ethereumTokenAddress: normalizeEthereumAddress(toHex(tokenValue, 20)),
		tokenOwnerL2: packedOwner,
		tokenIdL2: toHex(tokenIdValue),
		decimals: Number(decimalsValue),
		inventoryCap: capValue,
		mftStandardVkId: toHex(mftVkValue),
		vaultPublicKey: packedVault,
		universalBridgeVkId: toHex(bridgeVkValue),
		blockHeight: event.blockHeight,
		timestamp: event.timestamp,
		txnHash: event.txnHash,
		finalityStatus: event.finalityStatus
	}
}

export const buildRegistrySnapshot = (
	events: readonly RegistryArchiveEvent[]
): IndexedEthereumAssetRegistrySnapshot => {
	const records = events.map(parseEvent)
	const tokens = new Set<Address>()
	const assetIds = new Set<Hex>()
	const owners = new Set<Hex>()
	const tokenIds = new Set<Hex>()
	const first = records[0]
	for (const record of records) {
		if (tokens.has(record.ethereumTokenAddress)) throw new Error("Duplicate Ethereum token")
		if (assetIds.has(record.assetId)) throw new Error("Duplicate canonical asset ID")
		if (owners.has(record.tokenOwnerL2)) throw new Error("Duplicate L2 token owner")
		if (tokenIds.has(record.tokenIdL2)) throw new Error("Duplicate L2 token ID")
		if (
			first &&
			(record.mftStandardVkId !== first.mftStandardVkId ||
				record.vaultPublicKey !== first.vaultPublicKey ||
				record.universalBridgeVkId !== first.universalBridgeVkId)
		) {
			throw new Error("Registry event changed a shared runtime identity")
		}
		tokens.add(record.ethereumTokenAddress)
		assetIds.add(record.assetId)
		owners.add(record.tokenOwnerL2)
		tokenIds.add(record.tokenIdL2)
	}
	const tree = buildEthereumAssetRegistryTree(records)
	return {
		schemaVersion: ETHEREUM_ASSET_REGISTRY_SCHEMA_VERSION,
		depth: ETHEREUM_ASSET_REGISTRY_DEPTH,
		root: fieldHex(tree.root),
		count: records.length,
		finalityStatus: events.at(-1)?.finalityStatus ?? "canonical",
		records: records.map((record) => ({
			record,
			path: tree.path(record.registryIndex).map(fieldHex)
		}))
	}
}

export const verifyRegistryMembership = (
	snapshot: IndexedEthereumAssetRegistrySnapshot,
	entry: IndexedEthereumAssetEntry
): boolean => {
	if (
		snapshot.schemaVersion !== ETHEREUM_ASSET_REGISTRY_SCHEMA_VERSION ||
		snapshot.depth !== ETHEREUM_ASSET_REGISTRY_DEPTH ||
		entry.path.length !== ETHEREUM_ASSET_REGISTRY_DEPTH ||
		entry.record.registryIndex >= snapshot.count
	) {
		return false
	}
	try {
		const root = parseEthereumAssetRegistryField(snapshot.root, "Registry root")
		const path = entry.path.map((sibling) =>
			parseEthereumAssetRegistryField(sibling, "Registry path sibling")
		)
		return verifyEthereumAssetRegistryMembership(root, entry.record, path)
	} catch {
		return false
	}
}

export const findRegistryAsset = (
	snapshot: IndexedEthereumAssetRegistrySnapshot,
	lookup: RegistryAssetLookup
): IndexedEthereumAssetEntry => {
	const entry =
		"index" in lookup
			? snapshot.records.find(({ record }) => record.registryIndex === lookup.index)
			: "assetId" in lookup
				? snapshot.records.find(
						({ record }) => record.assetId.toLowerCase() === lookup.assetId.toLowerCase()
					)
				: snapshot.records.find(
						({ record }) =>
							record.ethereumTokenAddress === normalizeEthereumAddress(lookup.ethereumTokenAddress)
					)
	if (!entry) throw new Error("Unknown Ethereum asset registry record")
	return entry
}
