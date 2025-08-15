import { walletMachine } from "@lumina-dex/sdk"
import { useMachine, useSelector } from "@lumina-dex/sdk/vue"
import { defineStore } from "pinia"
import { bridgeMachine } from "~~/machines/bridge"

export const useBridgeStore = defineStore("bridge", () => {
	const wallet = useMachine(walletMachine)

	/** Wallet */
	const address = computed(() => wallet.snapshot.value.context.account ?? "")
	const displayAddress = computed(
		() => `${address?.value.slice(0, 6)}...${address?.value.slice(-4)}`
	)
	const currentNetwork = computed(() => wallet.snapshot.value.context.currentNetwork)
	const balances = useSelector(wallet.actorRef, (state) => state.context.balances)
	const walletLoaded = computed(
		() =>
			wallet.snapshot.value.matches("READY") ||
			wallet.snapshot.value.matches("SWITCHING_NETWORK") ||
			wallet.snapshot.value.matches("FETCHING_BALANCE")
	)

	/** Bridge */
	const bridge = useMachine(bridgeMachine, { input: { wallet: wallet.actorRef } })

	onMounted(() => {
		// auto-connect
		if (wallet.snapshot.value.matches("INIT")) {
			wallet.send({ type: "Connect" })
		}
	})

	return {
		wallet,
		bridge,
		address,
		displayAddress,
		currentNetwork,
		balances,
		walletLoaded
	}
})
