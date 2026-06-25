import type { BridgeNetwork } from "~~/machines/networks"
import { formatBridgeNetworkLabel, isMinaBridgeNetwork } from "~~/machines/networks"
import { selectedBridgeMinimumAmountMina } from "./bridgeInputs"

const shortBridgeNetworkLabel = (network: BridgeNetwork) =>
	formatBridgeNetworkLabel(network).startsWith("Mina") ? "Mina" : "Zeko"

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
	const minimumAmountMina = selectedBridgeMinimumAmountMina({ source, destination })
	const accountCreationMina = isMinaToZeko ? 0.1 : 1
	const sourceShortLabel = shortBridgeNetworkLabel(source)
	const destinationShortLabel = shortBridgeNetworkLabel(destination)

	return {
		routeLabel: `${formatBridgeNetworkLabel(source)} to ${formatBridgeNetworkLabel(destination)}`,
		sourceShortLabel,
		destinationShortLabel,
		minimumAmountMina,
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
