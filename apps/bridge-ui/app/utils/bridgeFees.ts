import type { BridgeNetwork } from "~~/machines/networks"
import { formatBridgeNetworkLabel, isMinaBridgeNetwork } from "~~/machines/networks"

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
	const minimumAmountMina = isMinaToZeko ? 5 : 3
	const routeFeeMina = isMinaToZeko ? 3 : 5
	const accountCreationMina = isMinaToZeko ? 0.1 : 1
	const routeShortLabel = `${shortBridgeNetworkLabel(source)} -> ${shortBridgeNetworkLabel(destination)}`

	return {
		routeLabel: `${formatBridgeNetworkLabel(source)} to ${formatBridgeNetworkLabel(destination)}`,
		routeShortLabel,
		routeFeeLabel: `${routeShortLabel} fee ${routeFeeMina} MINA`,
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
