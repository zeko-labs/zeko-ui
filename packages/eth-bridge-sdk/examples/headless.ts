import { EthereumBridgeClient } from "../src/index"

export const connectEthereumBridge = async (
	provider: Parameters<typeof EthereumBridgeClient.init>[0]["provider"],
	gatewayUrl: string,
	expectedChainId: number
): Promise<EthereumBridgeClient> =>
	EthereumBridgeClient.init({ gatewayUrl, provider, expectedChainId })
