import { Field, Poseidon } from "o1js"

export const ETHEREUM_ASSET_REGISTRY_SCHEMA_VERSION: number = 1
export const ETHEREUM_ASSET_REGISTRY_DEPTH: number = 8
export const ETHEREUM_ASSET_REGISTRY_CAPACITY: number = 1 << ETHEREUM_ASSET_REGISTRY_DEPTH

const PUBLIC_KEY_SIGN_BIT = 1n << 255n
const PUBLIC_KEY_X_MASK = PUBLIC_KEY_SIGN_BIT - 1n
const U32_MAX = (1n << 32n) - 1n
const U64_MAX = (1n << 64n) - 1n
const U128_MAX = (1n << 128n) - 1n
const U160_MAX = (1n << 160n) - 1n
const LEAF_PREFIX = "Ethereum asset registry leaf V1"
const NODE_PREFIX = "Ethereum asset registry node V1"

export type EthereumAssetRegistryPoseidonRecord = {
	readonly schemaVersion: number
	readonly registryIndex: number
	readonly assetId: string
	readonly ethereumTokenAddress: string
	readonly tokenOwnerL2: string
	readonly tokenIdL2: string
	readonly decimals: number
	readonly inventoryCap: bigint
	readonly mftStandardVkId: string
	readonly vaultPublicKey: string
	readonly universalBridgeVkId: string
}

export type EthereumAssetRegistryTree = {
	readonly root: Field
	readonly levels: readonly (readonly Field[])[]
	readonly path: (index: number) => readonly Field[]
}

const requireUnsigned = (value: bigint, label: string, maximum: bigint): bigint => {
	if (value < 0n || value > maximum) throw new Error(`${label} is outside its canonical range`)
	return value
}

const requireInteger = (value: number, label: string, maximum: number): bigint => {
	if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
		throw new Error(`${label} is outside its canonical range`)
	}
	return BigInt(value)
}

const parseHex = (value: string, bytes: number, label: string): bigint => {
	if (!new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value)) {
		throw new Error(`${label} must be a ${bytes}-byte hex value`)
	}
	return BigInt(value)
}

export const parseEthereumAssetRegistryField = (value: string, label: string): Field => {
	const parsed = parseHex(value, 32, label)
	if (parsed >= Field.ORDER) throw new Error(`${label} is not a canonical Pasta field`)
	return Field(parsed)
}

export const ethereumAssetRegistryFieldHex = (field: Field): `0x${string}` =>
	`0x${field.toBigInt().toString(16).padStart(64, "0")}`

const unpackPublicKey = (value: string, label: string): readonly [Field, Field] => {
	const packed = parseHex(value, 32, label)
	const x = packed & PUBLIC_KEY_X_MASK
	if (x >= Field.ORDER) throw new Error(`${label} has a non-canonical x-coordinate`)
	return Object.freeze([Field(x), Field(packed & PUBLIC_KEY_SIGN_BIT ? 1 : 0)])
}

export const ethereumAssetRegistryRecordFields = (
	record: EthereumAssetRegistryPoseidonRecord
): readonly Field[] => {
	const schemaVersion = requireInteger(
		record.schemaVersion,
		"Registry schema version",
		Number(U32_MAX)
	)
	const registryIndex = requireInteger(
		record.registryIndex,
		"Registry index",
		ETHEREUM_ASSET_REGISTRY_CAPACITY - 1
	)
	const assetId = parseHex(record.assetId, 32, "Asset ID")
	const tokenAddress = requireUnsigned(
		parseHex(record.ethereumTokenAddress, 20, "Ethereum token address"),
		"Ethereum token address",
		U160_MAX
	)
	const [ownerX, ownerOdd] = unpackPublicKey(record.tokenOwnerL2, "L2 token owner")
	const tokenId = parseEthereumAssetRegistryField(record.tokenIdL2, "L2 token ID")
	const decimals = requireInteger(record.decimals, "Ethereum asset decimals", 9)
	const inventoryCap = requireUnsigned(record.inventoryCap, "Inventory cap", U64_MAX)
	const mftStandardVkId = parseEthereumAssetRegistryField(
		record.mftStandardVkId,
		"MFT standard VK ID"
	)
	const [vaultX, vaultOdd] = unpackPublicKey(record.vaultPublicKey, "Shared vault public key")
	const universalBridgeVkId = parseEthereumAssetRegistryField(
		record.universalBridgeVkId,
		"Universal bridge VK ID"
	)

	return Object.freeze([
		Field(schemaVersion),
		Field(registryIndex),
		Field(assetId >> 128n),
		Field(assetId & U128_MAX),
		Field(tokenAddress),
		ownerX,
		ownerOdd,
		tokenId,
		Field(decimals),
		Field(inventoryCap),
		mftStandardVkId,
		vaultX,
		vaultOdd,
		universalBridgeVkId
	])
}

export const ethereumAssetRegistryLeaf = (record: EthereumAssetRegistryPoseidonRecord): Field =>
	Poseidon.hashWithPrefix(LEAF_PREFIX, [...ethereumAssetRegistryRecordFields(record)])

export const ethereumAssetRegistryNode = (left: Field, right: Field): Field =>
	Poseidon.hashWithPrefix(NODE_PREFIX, [left, right])

const buildLevels = (level: readonly Field[]): readonly (readonly Field[])[] => {
	const immutableLevel = Object.freeze([...level])
	if (immutableLevel.length === 1) return Object.freeze([immutableLevel])
	const parents = Object.freeze(
		Array.from({ length: immutableLevel.length / 2 }, (_, index) =>
			ethereumAssetRegistryNode(immutableLevel[index * 2], immutableLevel[index * 2 + 1])
		)
	)
	return Object.freeze([immutableLevel, ...buildLevels(parents)])
}

export const ethereumAssetRegistryPath = (
	levels: readonly (readonly Field[])[],
	index: number
): readonly Field[] => {
	requireInteger(index, "Registry index", ETHEREUM_ASSET_REGISTRY_CAPACITY - 1)
	if (levels.length !== ETHEREUM_ASSET_REGISTRY_DEPTH + 1 || levels.at(-1)?.length !== 1) {
		throw new Error("Ethereum asset registry Merkle tree has the wrong depth")
	}
	return Object.freeze(
		levels.slice(0, -1).map((level, height) => {
			const sibling = level[(index >> height) ^ 1]
			if (!sibling) throw new Error("Ethereum asset registry Merkle path is incomplete")
			return sibling
		})
	)
}

export const buildEthereumAssetRegistryTree = (
	records: readonly EthereumAssetRegistryPoseidonRecord[]
): EthereumAssetRegistryTree => {
	if (records.length > ETHEREUM_ASSET_REGISTRY_CAPACITY) {
		throw new Error("Ethereum asset registry exceeds its depth-8 capacity")
	}
	const byIndex = new Map(
		records.map((record) => {
			requireInteger(record.registryIndex, "Registry index", ETHEREUM_ASSET_REGISTRY_CAPACITY - 1)
			return [record.registryIndex, record] as const
		})
	)
	if (byIndex.size !== records.length) {
		throw new Error("Ethereum asset registry contains a duplicate index")
	}
	const leaves = Object.freeze(
		Array.from({ length: ETHEREUM_ASSET_REGISTRY_CAPACITY }, (_, index) => {
			const record = byIndex.get(index)
			return record ? ethereumAssetRegistryLeaf(record) : Field(0)
		})
	)
	const levels = buildLevels(leaves)
	const root = levels.at(-1)?.[0]
	if (!root) throw new Error("Ethereum asset registry root is missing")
	return Object.freeze({
		root,
		levels,
		path: (index: number) => ethereumAssetRegistryPath(levels, index)
	})
}

export const ethereumAssetRegistryMembershipRoot = (
	record: EthereumAssetRegistryPoseidonRecord,
	path: readonly Field[]
): Field => {
	if (path.length !== ETHEREUM_ASSET_REGISTRY_DEPTH) {
		throw new Error(
			`Ethereum asset membership path must have depth ${ETHEREUM_ASSET_REGISTRY_DEPTH}`
		)
	}
	return path.reduce(
		(node, sibling, height) =>
			record.registryIndex & (1 << height)
				? ethereumAssetRegistryNode(sibling, node)
				: ethereumAssetRegistryNode(node, sibling),
		ethereumAssetRegistryLeaf(record)
	)
}

export const verifyEthereumAssetRegistryMembership = (
	root: Field,
	record: EthereumAssetRegistryPoseidonRecord,
	path: readonly Field[]
): boolean => ethereumAssetRegistryMembershipRoot(record, path).equals(root).toBoolean()
