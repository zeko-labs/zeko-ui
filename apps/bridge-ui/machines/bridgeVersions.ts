import type { BridgeVersion } from "@zeko-labs/bridge-sdk"

type BridgeVersionOperation = {
	bridgeVersion: BridgeVersion
}

export const filterBridgeVersionOperations = <TOperation extends BridgeVersionOperation>(
	operations: readonly TOperation[]
): TOperation[] => operations.filter((operation) => operation.bridgeVersion === 2)
