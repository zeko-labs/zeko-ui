export const BRIDGE_DEBUG_MODE_STORAGE_KEY = "bridgeDebugMode"

export type BridgeDebugMode = "off" | "mock-backend"

type GetBridgeDebugModeOptions = {
	runtimeMode?: unknown
	storage?: Pick<Storage, "getItem"> | null
}

const bridgeDebugModes = new Set<BridgeDebugMode>(["off", "mock-backend"])

export const normalizeBridgeDebugMode = (value: unknown): BridgeDebugMode | null => {
	if (typeof value !== "string") return null
	const normalized = value.trim()
	if (normalized.length === 0 || normalized === "false") return "off"
	return bridgeDebugModes.has(normalized as BridgeDebugMode)
		? (normalized as BridgeDebugMode)
		: null
}

const safeStorage = (): Pick<Storage, "getItem"> | null => {
	try {
		return globalThis.localStorage ?? null
	} catch {
		return null
	}
}

const getStoredBridgeDebugMode = (storage: Pick<Storage, "getItem"> | null) => {
	try {
		return normalizeBridgeDebugMode(storage?.getItem(BRIDGE_DEBUG_MODE_STORAGE_KEY))
	} catch {
		return null
	}
}

export const getBridgeDebugMode = ({
	runtimeMode,
	storage = safeStorage()
}: GetBridgeDebugModeOptions = {}): BridgeDebugMode =>
	getStoredBridgeDebugMode(storage) ?? normalizeBridgeDebugMode(runtimeMode) ?? "off"
