import type { BridgeNetwork } from "~~/machines/networks"
import { formatBridgeNetworkLabel, isMinaBridgeNetwork } from "~~/machines/networks"
import { selectedBridgeMinimumAmountMina } from "./bridgeInputs"

const shortBridgeNetworkLabel = (network: BridgeNetwork) =>
	formatBridgeNetworkLabel(network).startsWith("Mina") ? "Mina" : "Zeko"

const staticBridgeFee = {
	totalMina: 0.4
} as const

const addMinaFees = (...fees: number[]) =>
	Number(fees.reduce((total, fee) => total + fee, 0).toFixed(10))

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
			maximumTotalMina: addMinaFees(
				staticBridgeFee.totalMina,
				accountCreationMina,
				accountCreationMina
			),
			destinationAccountLabel: isMinaToZeko ? "Zeko" : "Mina"
		}
	} as const
}

export type SelectedBridgeFeeDisclosure = ReturnType<typeof selectedBridgeFeeDisclosure>
