export const BRIDGE_DEBUG_MODE_STORAGE_KEY = "bridgeDebugMode"

export type BridgeDebugMode = "off" | "mock-backend"

type GetBridgeDebugModeOptions = {
	storage?: Pick<Storage, "getItem"> | null
	hostname?: unknown
}

const bridgeDebugModes = new Set<BridgeDebugMode>(["off", "mock-backend"])
const productionBridgeHost = "bridge.zeko.io"

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

const safeHostname = (): string | null => {
	try {
		return globalThis.location?.hostname ?? null
	} catch {
		return null
	}
}

const isProductionBridgeHost = (hostname: unknown) =>
	typeof hostname === "string" && hostname.trim().toLowerCase() === productionBridgeHost

export const getBridgeDebugMode = ({
	storage = safeStorage(),
	hostname = safeHostname()
}: GetBridgeDebugModeOptions = {}): BridgeDebugMode =>
	isProductionBridgeHost(hostname) ? "off" : getStoredBridgeDebugMode(storage) ?? "off"
