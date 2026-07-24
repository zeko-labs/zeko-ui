import { readFile, writeFile } from "node:fs/promises"
import { getAddress, type Hex } from "viem"
import { type EthereumAssetRecord, ethereumAssetRecordBatchMembership } from "../dist/index.js"

type ScenarioRecord = {
	schemaVersion: number
	registryIndex: number
	assetId: Hex
	ethereumToken: Hex
	tokenOwnerL2: Hex
	tokenIdL2: Hex
	decimals: number
	inventoryCap: string
	mftStandardVkId: Hex
	vaultPublicKey: Hex
	universalBridgeVkId: Hex
}

type Scenario = {
	ethereumAssets: Array<{ record: ScenarioRecord }>
}

const [scenarioPath, outputPath] = process.argv.slice(2)
if (!scenarioPath || !outputPath) {
	throw new Error("Usage: asset-record-batch.ts <bridge-scenario.json> <output.json>")
}

const scenario = JSON.parse(await readFile(scenarioPath, "utf8")) as Scenario
const records: EthereumAssetRecord[] = scenario.ethereumAssets.map(({ record }) => ({
	schemaVersion: record.schemaVersion,
	registryIndex: record.registryIndex,
	assetId: record.assetId,
	ethereumTokenAddress: getAddress(record.ethereumToken),
	tokenOwnerL2: record.tokenOwnerL2,
	tokenIdL2: record.tokenIdL2,
	decimals: record.decimals,
	inventoryCap: BigInt(record.inventoryCap),
	mftStandardVkId: record.mftStandardVkId,
	vaultPublicKey: record.vaultPublicKey,
	universalBridgeVkId: record.universalBridgeVkId
}))

const memberships = records.map((record) => ({
	token: record.ethereumTokenAddress,
	...ethereumAssetRecordBatchMembership(records, record)
}))
await writeFile(
	outputPath,
	`${JSON.stringify(memberships, (_, value) =>
		typeof value === "bigint" ? value.toString() : value
	)}\n`
)
