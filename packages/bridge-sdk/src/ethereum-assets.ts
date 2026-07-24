import { fetchEthereumAssetRegistryQuery } from "@zeko-labs/graphql"
import { Field, Poseidon, PublicKey, TokenId, UInt64 } from "o1js"
import {
	normalizeEthereumAssetId,
	splitEthereumAssetId,
	validateEthereumTokenBridgeConfig
} from "./ethereum"
import type { BridgeRuntime } from "./runtime"
import type {
	EthereumAssetLookup,
	EthereumAssetMembership,
	EthereumAssetRecord,
	EthereumTokenBridgeConfig
} from "./types"

const REGISTRY_DEPTH = 8
const REGISTRY_SCHEMA_VERSION = 1
const PUBLIC_KEY_SIGN_BIT = 1n << 255n
const PUBLIC_KEY_X_MASK = PUBLIC_KEY_SIGN_BIT - 1n
const U64_MAX = (1n << 64n) - 1n
const LEAF_PREFIX = "Ethereum asset registry leaf V1"
const NODE_PREFIX = "Ethereum asset registry node V1"

export type EthereumAssetRegistryApiRecord = {
	readonly schemaVersion: number
	readonly registryIndex: number
	readonly assetId: string
	readonly ethereumTokenAddress: string
	readonly tokenOwnerL2: string
	readonly tokenIdL2: string
	readonly decimals: number
	readonly inventoryCap: string
	readonly mftStandardVkId: string
	readonly vaultPublicKey: string
	readonly universalBridgeVkId: string
}

export type EthereumAssetRegistryApiEntry = {
	readonly path: readonly string[]
	readonly record: EthereumAssetRegistryApiRecord
}

export type EthereumAssetRegistryApiSnapshot = {
	readonly schemaVersion: number
	readonly depth: number
	readonly root: string
	readonly count: number
	readonly records: readonly EthereumAssetRegistryApiEntry[]
}

const requireInteger = (value: number, label: string, maximum: number): number => {
	if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
		throw new Error(`${label} is outside its canonical range`)
	}
	return value
}

const parseHex = (value: string, bytes: number, label: string): bigint => {
	if (!new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value)) {
		throw new Error(`${label} must be a ${bytes}-byte hex value`)
	}
	return BigInt(value)
}

const parseFieldHex = (value: string, label: string): Field => {
	const parsed = parseHex(value, 32, label)
	if (parsed >= Field.ORDER) throw new Error(`${label} is not a canonical Pasta field`)
	return Field(parsed)
}

const unpackPublicKey = (value: string, label: string): PublicKey => {
	const packed = parseHex(value, 32, label)
	const x = packed & PUBLIC_KEY_X_MASK
	if (x >= Field.ORDER) throw new Error(`${label} has a non-canonical x-coordinate`)
	return PublicKey.fromFields([Field(x), Field(packed & PUBLIC_KEY_SIGN_BIT ? 1 : 0)])
}

const rawAmountToMinaJson = (amount: bigint): string => {
	const precision = 1_000_000_000n
	const whole = amount / precision
	const remainder = amount % precision
	if (remainder === 0n) return whole.toString()
	const fraction = remainder.toString().padStart(9, "0").replace(/0+$/, "")
	return `${whole}.${fraction}`
}

const wordJson = (value: bigint): string =>
	`0x${value.toString(16).toUpperCase().padStart(64, "0")}`

const fieldJson = (field: Field): string => wordJson(field.toBigInt())

const packPublicKey = (publicKey: PublicKey, label: string): string => {
	const [x, odd] = publicKey.toFields()
	if (!x || !odd) throw new Error(`Invalid ${label}`)
	return wordJson(x.toBigInt() | (odd.toBigInt() === 0n ? 0n : PUBLIC_KEY_SIGN_BIT))
}

const recordFields = (record: EthereumAssetRecord): Field[] => {
	const [assetIdHigh, assetIdLow] = splitEthereumAssetId(record.assetId)
	const [ownerX, ownerOdd] = record.tokenOwnerL2.toFields()
	const [vaultX, vaultOdd] = record.vaultPublicKey.toFields()
	if (!ownerX || !ownerOdd || !vaultX || !vaultOdd) {
		throw new Error("Invalid compressed public key in Ethereum asset record")
	}
	return [
		Field(record.schemaVersion),
		Field(record.registryIndex),
		assetIdHigh,
		assetIdLow,
		Field(BigInt(record.ethereumTokenAddress)),
		ownerX,
		ownerOdd,
		record.tokenIdL2,
		Field(record.decimals),
		Field(record.inventoryCap.toBigInt()),
		record.mftStandardVkId,
		vaultX,
		vaultOdd,
		record.universalBridgeVkId
	]
}

const registryLeaf = (record: EthereumAssetRecord): Field =>
	Poseidon.hashWithPrefix(LEAF_PREFIX, recordFields(record))

const registryNode = (left: Field, right: Field): Field =>
	Poseidon.hashWithPrefix(NODE_PREFIX, [left, right])

const registryLevels = (records: readonly EthereumAssetRecord[]): Field[][] => {
	const leaves = Array.from({ length: 1 << REGISTRY_DEPTH }, () => Field(0))
	for (const record of records) leaves[record.registryIndex] = registryLeaf(record)
	const levels = [leaves]
	while (levels.at(-1)?.length !== 1) {
		const current = levels.at(-1)
		if (!current) throw new Error("Ethereum asset registry has no Merkle level")
		levels.push(
			Array.from({ length: current.length / 2 }, (_, index) =>
				registryNode(current[index * 2], current[index * 2 + 1])
			)
		)
	}
	return levels
}

const pathAt = (levels: readonly Field[][], index: number): Field[] =>
	levels.slice(0, -1).map((level, height) => {
		const sibling = level[(index >> height) ^ 1]
		if (!sibling) throw new Error("Ethereum asset registry Merkle path is incomplete")
		return sibling
	})

const verifyMembership = (
	root: Field,
	record: EthereumAssetRecord,
	path: readonly Field[]
): void => {
	if (path.length !== REGISTRY_DEPTH) {
		throw new Error(`Ethereum asset membership path must have depth ${REGISTRY_DEPTH}`)
	}
	let node = registryLeaf(record)
	for (let height = 0; height < REGISTRY_DEPTH; height++) {
		const sibling = path[height]
		if (!sibling) throw new Error("Ethereum asset membership path is incomplete")
		node =
			record.registryIndex & (1 << height)
				? registryNode(sibling, node)
				: registryNode(node, sibling)
	}
	if (!node.equals(root).toBoolean()) {
		throw new Error("Ethereum asset membership does not match the indexed registry root")
	}
}

const recordWitnessJson = (record: EthereumAssetRecord) => {
	const [assetIdHigh, assetIdLow] = splitEthereumAssetId(record.assetId)
	return {
		schema_version: record.schemaVersion.toString(),
		registry_index: record.registryIndex.toString(),
		asset_id_high: fieldJson(assetIdHigh),
		asset_id_low: fieldJson(assetIdLow),
		ethereum_token_address: fieldJson(Field(BigInt(record.ethereumTokenAddress))),
		token_owner_l2: record.tokenOwnerL2.toBase58(),
		token_id_l2: TokenId.toBase58(record.tokenIdL2),
		decimals: record.decimals.toString(),
		inventory_cap: rawAmountToMinaJson(record.inventoryCap.toBigInt()),
		mft_standard_vk_id: fieldJson(record.mftStandardVkId),
		vault_public_key: record.vaultPublicKey.toBase58(),
		universal_bridge_vk_id: fieldJson(record.universalBridgeVkId)
	}
}

const membershipWitnessJson = (
	root: Field,
	count: number,
	record: EthereumAssetRecord,
	path: readonly Field[]
): string =>
	JSON.stringify({
		state: {
			root: fieldJson(root),
			leaf_count: count.toString(),
			schema_version: record.schemaVersion.toString()
		},
		record: recordWitnessJson(record),
		path: path.map(fieldJson)
	})

const parseRecord = (
	runtime: Pick<BridgeRuntime, "ethereumAssets">,
	input: EthereumAssetRegistryApiRecord
): { record: EthereumAssetRecord; config: EthereumTokenBridgeConfig } => {
	const assets = runtime.ethereumAssets
	if (!assets) throw new Error("Universal Ethereum asset bridging is not configured")
	const schemaVersion = requireInteger(input.schemaVersion, "Registry schema version", 0xffffffff)
	const registryIndex = requireInteger(
		input.registryIndex,
		"Registry index",
		(1 << REGISTRY_DEPTH) - 1
	)
	const decimals = requireInteger(input.decimals, "Ethereum asset decimals", 9)
	const inventoryCap = BigInt(input.inventoryCap)
	if (inventoryCap <= 0n || inventoryCap > U64_MAX) {
		throw new Error("Ethereum asset inventory cap is outside uint64")
	}
	const tokenOwnerL2 = unpackPublicKey(input.tokenOwnerL2, "L2 token owner")
	const vaultPublicKey = unpackPublicKey(input.vaultPublicKey, "Shared vault public key")
	const record: EthereumAssetRecord = {
		schemaVersion,
		registryIndex,
		assetId: normalizeEthereumAssetId(input.assetId),
		ethereumTokenAddress: input.ethereumTokenAddress,
		tokenOwnerL2,
		tokenIdL2: parseFieldHex(input.tokenIdL2, "L2 token ID"),
		decimals,
		inventoryCap: UInt64.from(inventoryCap),
		mftStandardVkId: parseFieldHex(input.mftStandardVkId, "MFT standard VK ID"),
		vaultPublicKey,
		universalBridgeVkId: parseFieldHex(input.universalBridgeVkId, "Universal bridge VK ID")
	}
	if (schemaVersion !== REGISTRY_SCHEMA_VERSION || schemaVersion !== assets.registrySchemaVersion) {
		throw new Error(`Unsupported Ethereum asset registry schema ${schemaVersion}`)
	}
	if (!record.mftStandardVkId.equals(assets.approvedMftStandardVkId).toBoolean()) {
		throw new Error("Ethereum asset record uses the wrong MFT standard VK ID")
	}
	if (!record.vaultPublicKey.equals(assets.vaultPublicKey).toBoolean()) {
		throw new Error("Ethereum asset record uses the wrong shared vault public key")
	}
	if (!record.universalBridgeVkId.equals(assets.universalBridgeVkId).toBoolean()) {
		throw new Error("Ethereum asset record uses the wrong universal bridge VK ID")
	}
	const config = validateEthereumTokenBridgeConfig({
		assetId: record.assetId,
		ethereumTokenAddress: record.ethereumTokenAddress,
		tokenOwnerL2: record.tokenOwnerL2,
		tokenIdL2: record.tokenIdL2,
		holderAccountL2: record.vaultPublicKey,
		verificationKeyHash: assets.bridgeVerificationKeyHash
	})
	return {
		record: {
			...record,
			assetId: config.assetId,
			ethereumTokenAddress: config.ethereumTokenAddress
		},
		config
	}
}

const recordAsApi = (record: EthereumAssetRecord): EthereumAssetRegistryApiRecord => ({
	schemaVersion: record.schemaVersion,
	registryIndex: record.registryIndex,
	assetId: record.assetId,
	ethereumTokenAddress: record.ethereumTokenAddress,
	tokenOwnerL2: packPublicKey(record.tokenOwnerL2, "L2 token owner"),
	tokenIdL2: fieldJson(record.tokenIdL2),
	decimals: record.decimals,
	inventoryCap: record.inventoryCap.toBigInt().toString(),
	mftStandardVkId: fieldJson(record.mftStandardVkId),
	vaultPublicKey: packPublicKey(record.vaultPublicKey, "shared vault public key"),
	universalBridgeVkId: fieldJson(record.universalBridgeVkId)
})

export const parseEthereumAssetRegistrySnapshot = (
	runtime: Pick<BridgeRuntime, "ethereumAssets">,
	snapshot: EthereumAssetRegistryApiSnapshot
): Array<{ membership: EthereumAssetMembership; config: EthereumTokenBridgeConfig }> => {
	const schemaVersion = requireInteger(
		snapshot.schemaVersion,
		"Registry schema version",
		0xffffffff
	)
	const count = requireInteger(snapshot.count, "Registry count", 1 << REGISTRY_DEPTH)
	if (schemaVersion !== REGISTRY_SCHEMA_VERSION || snapshot.depth !== REGISTRY_DEPTH) {
		throw new Error("Ethereum asset registry root/count/schema is unsupported")
	}
	const root = parseFieldHex(snapshot.root, "Ethereum asset registry root")
	return snapshot.records.map((entry) => {
		const { record, config } = parseRecord(runtime, entry.record)
		if (record.registryIndex >= count) {
			throw new Error("Ethereum asset registry record is outside the committed count")
		}
		const path = entry.path.map((value) =>
			parseFieldHex(value, "Ethereum asset registry path sibling")
		)
		verifyMembership(root, record, path)
		return {
			config,
			membership: {
				root,
				count,
				schemaVersion,
				record,
				path,
				witnessJson: membershipWitnessJson(root, count, record, path)
			}
		}
	})
}

const lookupVariables = (
	lookup?: EthereumAssetLookup
): {
	root?: string
	index?: number
	assetId?: string
	ethereumTokenAddress?: string
} => {
	if (!lookup) return {}
	if ("index" in lookup) return { index: lookup.index }
	if ("assetId" in lookup) return { assetId: normalizeEthereumAssetId(lookup.assetId) }
	return { ethereumTokenAddress: lookup.ethereumTokenAddress }
}

export async function fetchEthereumAssetRegistry(
	runtime: BridgeRuntime,
	lookup?: EthereumAssetLookup
): Promise<Array<{ membership: EthereumAssetMembership; config: EthereumTokenBridgeConfig }>> {
	const result = await runtime
		.actionsApiClient()
		.query(fetchEthereumAssetRegistryQuery, lookupVariables(lookup))
	if (result.error) {
		throw new Error(`Failed to fetch the Ethereum asset registry: ${result.error.message}`)
	}
	const snapshot = result.data?.ethereumAssetRegistry
	if (!snapshot) {
		if (!lookup) return []
		throw new Error("The Ethereum asset registry has no indexed checkpoint")
	}
	const records = (snapshot.records ?? []).map((entry) => {
		if (!entry?.record || !entry.path) {
			throw new Error("The Ethereum asset registry API returned an incomplete membership")
		}
		const record = entry.record
		if (
			record.schemaVersion === null ||
			record.registryIndex === null ||
			record.assetId === null ||
			record.ethereumTokenAddress === null ||
			record.tokenOwnerL2 === null ||
			record.tokenIdL2 === null ||
			record.decimals === null ||
			record.inventoryCap === null ||
			record.mftStandardVkId === null ||
			record.vaultPublicKey === null ||
			record.universalBridgeVkId === null
		) {
			throw new Error("The Ethereum asset registry API returned an incomplete record")
		}
		return {
			path: entry.path,
			record: {
				schemaVersion: record.schemaVersion,
				registryIndex: record.registryIndex,
				assetId: record.assetId,
				ethereumTokenAddress: record.ethereumTokenAddress,
				tokenOwnerL2: record.tokenOwnerL2,
				tokenIdL2: record.tokenIdL2,
				decimals: record.decimals,
				inventoryCap: record.inventoryCap,
				mftStandardVkId: record.mftStandardVkId,
				vaultPublicKey: record.vaultPublicKey,
				universalBridgeVkId: record.universalBridgeVkId
			}
		}
	})
	if (
		snapshot.schemaVersion === null ||
		snapshot.depth === null ||
		snapshot.root === null ||
		snapshot.count === null
	) {
		throw new Error("The Ethereum asset registry API returned an incomplete checkpoint")
	}
	const parsed = parseEthereumAssetRegistrySnapshot(runtime, {
		schemaVersion: snapshot.schemaVersion,
		depth: snapshot.depth,
		root: snapshot.root,
		count: snapshot.count,
		records
	})
	if (lookup && parsed.length !== 1) {
		throw new Error("The requested Ethereum asset is not present in the indexed registry")
	}
	if (!lookup && parsed.length !== snapshot.count) {
		throw new Error("The indexed Ethereum asset registry is not exhaustive")
	}
	return parsed
}

export async function fetchEthereumAsset(
	runtime: BridgeRuntime,
	lookup: EthereumAssetLookup
): Promise<{ membership: EthereumAssetMembership; config: EthereumTokenBridgeConfig }> {
	const [asset] = await fetchEthereumAssetRegistry(runtime, lookup)
	if (!asset) throw new Error("The requested Ethereum asset is not registered")
	return asset
}

export type PreparedEthereumAssetRegistration = {
	readonly oldRoot: Field
	readonly oldCount: number
	readonly candidate: EthereumAssetRecord
	readonly appendPath: readonly Field[]
	readonly witnessJson: string
}

export function prepareEthereumAssetRegistrationFromRegistry(
	runtime: Pick<BridgeRuntime, "ethereumAssets">,
	current: ReadonlyArray<{
		membership: EthereumAssetMembership
		config: EthereumTokenBridgeConfig
	}>,
	input: EthereumAssetRecord
): PreparedEthereumAssetRegistration {
	if (current.length >= 1 << REGISTRY_DEPTH) {
		throw new Error("The Ethereum asset registry is full")
	}
	const { record: candidate } = parseRecord(runtime, recordAsApi(input))
	if (candidate.registryIndex !== current.length) {
		throw new Error(
			`Ethereum asset candidate index ${candidate.registryIndex} does not match next index ${current.length}`
		)
	}
	const records = current.map(({ membership }, index) => {
		if (membership.record.registryIndex !== index) {
			throw new Error("The indexed Ethereum asset registry is not a dense ordered list")
		}
		return membership.record
	})
	for (const record of records) {
		if (
			record.assetId === candidate.assetId ||
			record.ethereumTokenAddress.toLowerCase() === candidate.ethereumTokenAddress.toLowerCase() ||
			record.tokenOwnerL2.equals(candidate.tokenOwnerL2).toBoolean() ||
			record.tokenIdL2.equals(candidate.tokenIdL2).toBoolean()
		) {
			throw new Error("Ethereum asset candidate duplicates an immutable registry identity")
		}
	}
	const levels = registryLevels(records)
	const oldRoot = levels.at(-1)?.[0]
	if (!oldRoot) throw new Error("The Ethereum asset registry root is missing")
	const indexedRoot = current[0]?.membership.root
	if (indexedRoot && !indexedRoot.equals(oldRoot).toBoolean()) {
		throw new Error("The exhaustive indexed registry does not match its committed root")
	}
	const appendPath = pathAt(levels, candidate.registryIndex)
	return {
		oldRoot,
		oldCount: records.length,
		candidate,
		appendPath,
		witnessJson: JSON.stringify({
			old_state: {
				root: fieldJson(oldRoot),
				leaf_count: records.length.toString(),
				schema_version: candidate.schemaVersion.toString()
			},
			candidate: recordWitnessJson(candidate),
			existing: current.map(({ membership }) => [
				recordWitnessJson(membership.record),
				membership.path.map(fieldJson)
			]),
			append_path: appendPath.map(fieldJson)
		})
	}
}

export async function prepareEthereumAssetRegistration(
	runtime: BridgeRuntime,
	input: EthereumAssetRecord
): Promise<PreparedEthereumAssetRegistration> {
	const current = await fetchEthereumAssetRegistry(runtime)
	return prepareEthereumAssetRegistrationFromRegistry(runtime, current, input)
}
