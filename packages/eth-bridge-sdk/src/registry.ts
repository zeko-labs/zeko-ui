import {
	buildEthereumAssetRegistryTree,
	ethereumAssetRegistryFieldHex,
	ethereumAssetRegistryLeaf,
	parseEthereumAssetRegistryField,
	verifyEthereumAssetRegistryMembership
} from "@zeko-labs/bridge-sdk"
import {
	type Address,
	concatHex,
	encodeAbiParameters,
	getAddress,
	type Hex,
	keccak256,
	parseAbiParameters,
	toBytes
} from "viem"

const RECORD_SCHEMA_V1 = 1
const DEFAULT_DEPTH = 8
const U64_MAX = 2n ** 64n - 1n
const ZERO_WORD = `0x${"00".repeat(32)}` as Hex
const RECORD_DOMAIN = keccak256(toBytes("ZEKO_ERC20_ASSET_RECORD_V1"))
const RECORD_BATCH_LEAF_DOMAIN = keccak256(toBytes("ZEKO_ASSET_RECORD_BATCH_LEAF_V1"))
const RECORD_BATCH_NODE_DOMAIN = keccak256(toBytes("ZEKO_ASSET_RECORD_BATCH_NODE_V1"))

export type EthereumAssetRecord = {
	readonly schemaVersion: number
	readonly registryIndex: number
	readonly assetId: Hex
	readonly ethereumTokenAddress: Address
	readonly tokenOwnerL2: Hex
	readonly tokenIdL2: Hex
	readonly decimals: number
	readonly inventoryCap: bigint
	readonly mftStandardVkId: Hex
	readonly vaultPublicKey: Hex
	readonly universalBridgeVkId: Hex
}

export type EthereumAssetRegistryEntry = {
	readonly record: EthereumAssetRecord
	readonly path: readonly Hex[]
}

export type EthereumAssetRegistrySnapshot = {
	readonly schemaVersion: number
	readonly root: Hex
	readonly count: number
	readonly depth: number
	readonly records: readonly EthereumAssetRegistryEntry[]
}

export type EthereumAssetRegistryConfig = {
	readonly schemaVersion: number
	readonly depth: number
	readonly mftStandardVkId: Hex
	readonly vaultPublicKey: Hex
	readonly universalBridgeVkId: Hex
}

export type EthereumAssetMembership = EthereumAssetRegistryEntry & {
	root: Hex
	count: number
	schemaVersion: number
}

export type EthereumAssetRecordBatchMembership = {
	root: Hex
	count: number
	recordHash: Hex
	recordCommitment: Hex
	registryIndex: number
	proof: readonly Hex[]
}

const word = (value: Hex, label: string): Hex => {
	if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
		throw new Error(`${label} must be a 32-byte hex value`)
	}
	return value.toLowerCase() as Hex
}

const normalizeRecord = (record: EthereumAssetRecord): EthereumAssetRecord => {
	if (
		!Number.isSafeInteger(record.schemaVersion) ||
		record.schemaVersion !== RECORD_SCHEMA_V1 ||
		!Number.isSafeInteger(record.registryIndex) ||
		record.registryIndex < 0 ||
		record.registryIndex >= 2 ** DEFAULT_DEPTH ||
		!Number.isSafeInteger(record.decimals) ||
		record.decimals < 0 ||
		record.decimals > 9 ||
		record.inventoryCap <= 0n ||
		record.inventoryCap > U64_MAX
	) {
		throw new Error("Invalid canonical Ethereum asset record")
	}
	const normalized = {
		...record,
		assetId: word(record.assetId, "Asset ID"),
		ethereumTokenAddress: getAddress(record.ethereumTokenAddress),
		tokenOwnerL2: word(record.tokenOwnerL2, "L2 token owner"),
		tokenIdL2: word(record.tokenIdL2, "L2 token ID"),
		mftStandardVkId: word(record.mftStandardVkId, "MFT standard VK"),
		vaultPublicKey: word(record.vaultPublicKey, "Shared vault public key"),
		universalBridgeVkId: word(record.universalBridgeVkId, "Universal bridge VK")
	}
	if (
		normalized.assetId === ZERO_WORD ||
		normalized.tokenOwnerL2 === ZERO_WORD ||
		normalized.tokenIdL2 === ZERO_WORD ||
		normalized.mftStandardVkId === ZERO_WORD ||
		normalized.vaultPublicKey === ZERO_WORD ||
		normalized.universalBridgeVkId === ZERO_WORD ||
		normalized.tokenOwnerL2 === normalized.vaultPublicKey
	) {
		throw new Error("Canonical Ethereum asset record contains an invalid zero or shared identity")
	}
	return normalized
}

const recordKey = (record: EthereumAssetRecord): string =>
	JSON.stringify({
		...record,
		inventoryCap: record.inventoryCap.toString()
	})

const samePath = (left: readonly Hex[], right: readonly Hex[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index])

const immutableRecord = (record: EthereumAssetRecord): EthereumAssetRecord =>
	Object.freeze({ ...record })

const immutableEntry = (
	record: EthereumAssetRecord,
	path: readonly Hex[]
): EthereumAssetRegistryEntry =>
	Object.freeze({
		record: immutableRecord(record),
		path: Object.freeze([...path])
	})

export const hashEthereumAssetRecord = (input: EthereumAssetRecord): Hex => {
	const record = normalizeRecord(input)
	return keccak256(
		encodeAbiParameters(
			parseAbiParameters(
				"bytes32,uint32,uint32,bytes32,address,bytes32,bytes32,uint8,uint64,bytes32,bytes32,bytes32"
			),
			[
				RECORD_DOMAIN,
				record.schemaVersion,
				record.registryIndex,
				record.assetId,
				record.ethereumTokenAddress,
				record.tokenOwnerL2,
				record.tokenIdL2,
				record.decimals,
				record.inventoryCap,
				record.mftStandardVkId,
				record.vaultPublicKey,
				record.universalBridgeVkId
			]
		)
	)
}

export const ethereumAssetRecordBatchMembership = (
	records: readonly EthereumAssetRecord[],
	target: EthereumAssetRecord
): EthereumAssetRecordBatchMembership => {
	if (records.length === 0 || records.length > 2 ** DEFAULT_DEPTH) {
		throw new Error("Asset record settlement batch must contain between 1 and 256 records")
	}
	const normalizedTarget = normalizeRecord(target)
	const targetHash = hashEthereumAssetRecord(normalizedTarget)
	let targetFound = false
	let level = Array.from({ length: 2 ** DEFAULT_DEPTH }, (): Hex => ZERO_WORD)
	for (const input of records) {
		const record = normalizeRecord(input)
		if (record.registryIndex >= level.length || level[record.registryIndex] !== ZERO_WORD) {
			throw new Error("Asset record settlement batch contains a duplicate or invalid index")
		}
		const recordHash = hashEthereumAssetRecord(record)
		level[record.registryIndex] = keccak256(concatHex([RECORD_BATCH_LEAF_DOMAIN, recordHash]))
		if (recordHash === targetHash && record.registryIndex === normalizedTarget.registryIndex) {
			targetFound = true
		}
	}
	if (!targetFound) {
		throw new Error("Target asset record is not in the settlement batch")
	}

	const proof: Hex[] = []
	let index = normalizedTarget.registryIndex
	for (let depth = 0; depth < DEFAULT_DEPTH; depth++) {
		proof.push(level[index ^ 1] ?? ZERO_WORD)
		const parents: Hex[] = []
		for (let cursor = 0; cursor < level.length; cursor += 2) {
			parents.push(
				keccak256(
					concatHex([
						RECORD_BATCH_NODE_DOMAIN,
						level[cursor] ?? ZERO_WORD,
						level[cursor + 1] ?? ZERO_WORD
					])
				)
			)
		}
		level = parents
		index >>= 1
	}
	return {
		root: level[0] ?? ZERO_WORD,
		count: records.length,
		recordHash: targetHash,
		recordCommitment: ethereumAssetRegistryFieldHex(
			ethereumAssetRegistryLeaf(normalizedTarget)
		) as Hex,
		registryIndex: normalizedTarget.registryIndex,
		proof
	}
}

export class EthereumAssetRegistry {
	readonly #byAssetId = new Map<Hex, EthereumAssetRegistryEntry>()
	readonly #byIndex = new Map<number, EthereumAssetRegistryEntry>()
	readonly #byToken = new Map<Address, EthereumAssetRegistryEntry>()
	readonly #config: EthereumAssetRegistryConfig
	readonly #snapshot: EthereumAssetRegistrySnapshot

	public constructor(input: EthereumAssetRegistrySnapshot, config?: EthereumAssetRegistryConfig) {
		const schemaVersion = input.schemaVersion
		const depth = input.depth
		if (
			schemaVersion !== RECORD_SCHEMA_V1 ||
			!Number.isSafeInteger(input.count) ||
			input.count < 0 ||
			input.count !== input.records.length ||
			!Number.isSafeInteger(depth) ||
			depth !== DEFAULT_DEPTH ||
			input.count > 2 ** depth
		) {
			throw new Error("Invalid Ethereum asset registry root/count/schema")
		}
		const root = word(input.root, "Registry root")
		const entries = input.records.map(({ record, path }, index) => {
			const normalized = normalizeRecord(record)
			if (normalized.registryIndex !== index || path.length !== depth) {
				throw new Error("Ethereum asset registry is not a dense list or has a wrong path width")
			}
			return immutableEntry(
				normalized,
				path.map((sibling) => word(sibling, "Registry path sibling"))
			)
		})
		const rootField = parseEthereumAssetRegistryField(root, "Registry root")
		const tree = buildEthereumAssetRegistryTree(entries.map(({ record }) => record))
		if (ethereumAssetRegistryFieldHex(tree.root) !== root) {
			throw new Error("Ethereum asset registry records do not match the advertised registry root")
		}
		for (const entry of entries) {
			const path = entry.path.map((sibling) =>
				parseEthereumAssetRegistryField(sibling, "Registry path sibling")
			)
			const expectedPath = tree
				.path(entry.record.registryIndex)
				.map((sibling) => ethereumAssetRegistryFieldHex(sibling))
			if (
				!samePath(entry.path, expectedPath) ||
				!verifyEthereumAssetRegistryMembership(rootField, entry.record, path)
			) {
				throw new Error(
					"Ethereum asset registry membership does not match the advertised registry root"
				)
			}
		}
		const first = entries[0]?.record
		this.#config = {
			schemaVersion,
			depth,
			mftStandardVkId: word(
				config?.mftStandardVkId ?? first?.mftStandardVkId ?? ZERO_WORD,
				"MFT standard VK"
			),
			vaultPublicKey: word(
				config?.vaultPublicKey ?? first?.vaultPublicKey ?? ZERO_WORD,
				"Shared vault public key"
			),
			universalBridgeVkId: word(
				config?.universalBridgeVkId ?? first?.universalBridgeVkId ?? ZERO_WORD,
				"Universal bridge VK"
			)
		}
		if (config && (config.schemaVersion !== schemaVersion || config.depth !== depth)) {
			throw new Error("Registry configuration does not match the snapshot")
		}

		const owners = new Set<Hex>()
		const tokenIds = new Set<Hex>()
		for (const entry of entries) {
			const record = entry.record
			if (this.#byToken.has(record.ethereumTokenAddress)) {
				throw new Error("Duplicate Ethereum token in asset registry")
			}
			if (this.#byAssetId.has(record.assetId)) {
				throw new Error("Duplicate canonical asset ID in asset registry")
			}
			if (owners.has(record.tokenOwnerL2) || tokenIds.has(record.tokenIdL2)) {
				throw new Error("Duplicate L2 token identity in asset registry")
			}
			if (record.mftStandardVkId !== this.#config.mftStandardVkId) {
				throw new Error("Asset record uses the wrong MFT standard VK")
			}
			if (record.vaultPublicKey !== this.#config.vaultPublicKey) {
				throw new Error("Asset record uses the wrong shared vault public key")
			}
			if (record.universalBridgeVkId !== this.#config.universalBridgeVkId) {
				throw new Error("Asset record uses the wrong universal bridge VK")
			}
			this.#byIndex.set(record.registryIndex, entry)
			this.#byToken.set(record.ethereumTokenAddress, entry)
			this.#byAssetId.set(record.assetId, entry)
			owners.add(record.tokenOwnerL2)
			tokenIds.add(record.tokenIdL2)
		}
		this.#snapshot = Object.freeze({
			schemaVersion,
			root,
			count: input.count,
			depth,
			records: Object.freeze([...entries])
		})
	}

	public get root(): Hex {
		return this.#snapshot.root
	}

	public get count(): number {
		return this.#snapshot.count
	}

	public get schemaVersion(): number {
		return this.#snapshot.schemaVersion
	}

	public byIndex(index: number): EthereumAssetRegistryEntry {
		const entry = this.#byIndex.get(index)
		if (!entry) throw new Error(`Unknown Ethereum asset registry index ${index}`)
		return immutableEntry(entry.record, entry.path)
	}

	public byAssetId(assetId: Hex): EthereumAssetRegistryEntry {
		const entry = this.#byAssetId.get(word(assetId, "Asset ID"))
		if (!entry) throw new Error(`Unknown Ethereum asset ID ${assetId}`)
		return immutableEntry(entry.record, entry.path)
	}

	public byEthereumToken(token: Address): EthereumAssetRegistryEntry {
		const normalized = getAddress(token)
		const entry = this.#byToken.get(normalized)
		if (!entry) throw new Error(`Unknown Ethereum asset token ${normalized}`)
		return immutableEntry(entry.record, entry.path)
	}

	public membership(record: EthereumAssetRecord): EthereumAssetMembership {
		const normalized = normalizeRecord(record)
		const entry = this.byIndex(normalized.registryIndex)
		if (recordKey(entry.record) !== recordKey(normalized)) {
			throw new Error("Asset record does not match the authenticated registry snapshot")
		}
		return Object.freeze({
			...entry,
			root: this.root,
			count: this.count,
			schemaVersion: this.schemaVersion
		})
	}

	public verifyMembership(input: EthereumAssetMembership): EthereumAssetMembership {
		if (
			word(input.root, "Registry root") !== this.root ||
			input.count !== this.count ||
			input.schemaVersion !== this.schemaVersion
		) {
			throw new Error("Membership witness uses the wrong registry root/count/schema")
		}
		const expected = this.membership(input.record)
		const path = input.path.map((sibling) => word(sibling, "Registry path sibling"))
		if (!samePath(expected.path, path)) {
			throw new Error("Membership witness uses the wrong registry path")
		}
		return expected
	}

	public refresh(next: EthereumAssetRegistrySnapshot): EthereumAssetRegistry {
		const refreshed = new EthereumAssetRegistry(next, this.#config)
		if (refreshed.count < this.count) {
			throw new Error("Append-only Ethereum asset registry count cannot decrease")
		}
		for (let index = 0; index < this.count; index++) {
			if (recordKey(this.byIndex(index).record) !== recordKey(refreshed.byIndex(index).record)) {
				throw new Error("Append-only Ethereum asset registry record changed")
			}
		}
		return refreshed
	}
}
