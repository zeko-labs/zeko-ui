import { walletMachine } from "@zeko/sdk"
import { defineStore } from "pinia"
import { bridgeMachine } from "~~/machines/bridge"
import { getBridgeDebugMode } from "~~/machines/debugMode"
import { useMachine } from "~~/machines/vue-xstate"

export const useBridgeStore = defineStore("bridge", () => {
	const debugMode = getBridgeDebugMode()
	const wallet = useMachine(walletMachine)

	/** Wallet */
	const address = computed(() => wallet.snapshot.value.context.account ?? "")
	const displayAddress = computed(
		() => `${address?.value.slice(0, 6)}...${address?.value.slice(-4)}`
	)
	const currentNetwork = computed(() => wallet.snapshot.value.context.currentNetwork)
	const balances = computed(() => wallet.snapshot.value.context.balances)
	const walletLoaded = computed(
		() =>
			address.value.length > 0 &&
			(wallet.snapshot.value.matches("READY") || wallet.snapshot.value.matches("SWITCHING_NETWORK"))
	)

	/** Bridge */
	const bridge = useMachine(bridgeMachine, {
		input: { wallet: wallet.actorRef, debugMode }
	})

	onBeforeMount(() => {
		// auto-connect
		if (wallet.snapshot.value.matches("INIT")) {
			wallet.send({ type: "Connect" })
		}
	})

	return {
		wallet,
		bridge,
		debugMode,
		address,
		displayAddress,
		currentNetwork,
		balances,
		walletLoaded
	}
})
