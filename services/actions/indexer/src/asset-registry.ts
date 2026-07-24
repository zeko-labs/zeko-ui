import { Field, Poseidon } from "o1js"
import { type Address, getAddress, type Hex } from "viem"

const REGISTRY_SCHEMA_VERSION = 1
const REGISTRY_DEPTH = 8
const REGISTRY_CAPACITY = 1 << REGISTRY_DEPTH
const LEAF_PREFIX = "Ethereum asset registry leaf V1"
const NODE_PREFIX = "Ethereum asset registry node V1"
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

const fieldHex = (value: Field): Hex => toHex(value.toBigInt())

const packPublicKey = (x: bigint, isOdd: boolean): Hex =>
	toHex(x | (isOdd ? COMPRESSED_KEY_ODD_BIT : 0n))

const unpackPublicKey = (value: Hex): [bigint, bigint] => {
	const packed = BigInt(value)
	return [packed & (COMPRESSED_KEY_ODD_BIT - 1n), packed & COMPRESSED_KEY_ODD_BIT ? 1n : 0n]
}

const recordFields = (record: IndexedEthereumAssetRecord): Field[] => {
	const assetId = BigInt(record.assetId)
	const [ownerX, ownerIsOdd] = unpackPublicKey(record.tokenOwnerL2)
	const [vaultX, vaultIsOdd] = unpackPublicKey(record.vaultPublicKey)
	return [
		Field(record.schemaVersion),
		Field(record.registryIndex),
		Field(assetId >> 128n),
		Field(assetId & U128_MAX),
		Field(BigInt(record.ethereumTokenAddress)),
		Field(ownerX),
		Field(ownerIsOdd),
		Field(BigInt(record.tokenIdL2)),
		Field(record.decimals),
		Field(record.inventoryCap),
		Field(BigInt(record.mftStandardVkId)),
		Field(vaultX),
		Field(vaultIsOdd),
		Field(BigInt(record.universalBridgeVkId))
	]
}

const leafHash = (record: IndexedEthereumAssetRecord): Field =>
	Poseidon.hashWithPrefix(LEAF_PREFIX, recordFields(record))

const nodeHash = (left: Field, right: Field): Field =>
	Poseidon.hashWithPrefix(NODE_PREFIX, [left, right])

const levelsFromLeaves = (leaves: Field[]): Field[][] => {
	const levels = [leaves]
	let level = leaves
	while (level.length > 1) {
		const next = Array.from({ length: level.length / 2 }, (_, index) =>
			nodeHash(level[index * 2], level[index * 2 + 1])
		)
		levels.push(next)
		level = next
	}
	return levels
}

const pathAt = (levels: Field[][], index: number): Hex[] =>
	levels.slice(0, -1).map((level, height) => fieldHex(level[(index >> height) ^ 1]))

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
	if (schemaVersion !== REGISTRY_SCHEMA_VERSION) {
		throw new Error(`Unsupported registry schema version ${schemaVersion}`)
	}
	if (registryIndex !== expectedIndex || registryIndex >= REGISTRY_CAPACITY) {
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
		ethereumTokenAddress: getAddress(toHex(tokenValue, 20)),
		tokenOwnerL2: packedOwner,
		tokenIdL2: toHex(tokenIdValue),
		decimals: Number(decimalsValue),
		inventoryCap: capValue,
		mftStandardVkId: toHex(mftVkValue),
		vaultPublicKey: packedVault,
		universalBridgeVkId: toHex(bridgeVkValue),
		blockHeight: event.blockHeight,
		timestamp: event.timestamp,
		txnHash: event.txnHash
	}
}

export const buildRegistrySnapshot = (
	events: RegistryArchiveEvent[]
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
	const leaves = Array.from({ length: REGISTRY_CAPACITY }, () => Field(0))
	for (const record of records) leaves[record.registryIndex] = leafHash(record)
	const levels = levelsFromLeaves(leaves)
	return {
		schemaVersion: REGISTRY_SCHEMA_VERSION,
		depth: REGISTRY_DEPTH,
		root: fieldHex(levels.at(-1)?.[0] ?? Field(0)),
		count: records.length,
		records: records.map((record) => ({
			record,
			path: pathAt(levels, record.registryIndex)
		}))
	}
}

export const verifyRegistryMembership = (
	snapshot: IndexedEthereumAssetRegistrySnapshot,
	entry: IndexedEthereumAssetEntry
): boolean => {
	if (
		snapshot.schemaVersion !== REGISTRY_SCHEMA_VERSION ||
		snapshot.depth !== REGISTRY_DEPTH ||
		entry.path.length !== REGISTRY_DEPTH ||
		entry.record.registryIndex >= snapshot.count
	) {
		return false
	}
	let node = leafHash(entry.record)
	for (let height = 0; height < REGISTRY_DEPTH; height++) {
		const sibling = Field(BigInt(entry.path[height]))
		node =
			entry.record.registryIndex & (1 << height) ? nodeHash(sibling, node) : nodeHash(node, sibling)
	}
	return fieldHex(node) === snapshot.root.toLowerCase()
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
						({ record }) => record.ethereumTokenAddress === getAddress(lookup.ethereumTokenAddress)
					)
	if (!entry) throw new Error("Unknown Ethereum asset registry record")
	return entry
}
