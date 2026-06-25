import type { BridgeNetwork } from "~~/machines/networks"
import { formatBridgeNetworkLabel, isMinaBridgeNetwork } from "~~/machines/networks"

const staticBridgeFee = {
	requestMina: 0.1,
	claimMina: 0.1,
	totalMina: 0.2
} as const

export const selectedBridgeFeeDisclosure = ({
	source,
	destination
}: {
	source: BridgeNetwork
	destination: BridgeNetwork
}) => {
	const isMinaToZeko = isMinaBridgeNetwork(source)
	const accountCreationMina = isMinaToZeko ? 0.1 : 1

	return {
		routeLabel: `${formatBridgeNetworkLabel(source)} to ${formatBridgeNetworkLabel(destination)}`,
		static: staticBridgeFee,
		firstTransfer: {
			helperAccountCreationMina: accountCreationMina,
			recipientAccountCreationMina: accountCreationMina,
			maximumTotalMina: staticBridgeFee.totalMina + accountCreationMina * 2,
			destinationAccountLabel: isMinaToZeko ? "Zeko" : "Mina"
		}
	} as const
}

export type SelectedBridgeFeeDisclosure = ReturnType<typeof selectedBridgeFeeDisclosure>
