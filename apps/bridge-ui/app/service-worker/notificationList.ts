import type { BridgeOperationContext } from "~~/machines/bridgeOperation"
import { dispatch } from "./notifications"

export const finalizeNotification = async (context: BridgeOperationContext) => {
	await dispatch({
		title: `Zeko Bridge ${context.direction === "deposit" ? "Deposit" : "Withdrawal"} Ready to Finalize`,
		options: {
			body: `Your ${context.amount} MINA ${context.direction} is ready to finalize. Click on 'Finalize' to start the process.`,
			badge: `${window.origin}/favicon.svg`,
			tag: `bridge_${context.wallet.getSnapshot().context.currentNetwork}_${context.direction}_finalize`
		}
	})
}
