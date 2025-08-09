import { PublicKey, walletMachine } from "@lumina-dex/sdk"
import { useActor, useSelector } from "@lumina-dex/sdk/vue"
import { defineStore } from "pinia"

const getPublicKey = (address: string) => {
	return PublicKey.fromBase58(address)
}

export const useWalletStore = defineStore("wallet", () => {
	console.log("Store !")
	const { snapshot, send, actorRef } = useActor(walletMachine, {
		inspect: (event) => {
			if (event.type === "@xstate.event") {
				// console.log(event)
			}
		}
	})

	const address = computed(() => snapshot.value.context.account ?? "")

	const displayAddress = computed(() => {
		return `${address?.value.slice(0, 6)}...${address?.value.slice(-4)}`
	})

	const currentNetwork = computed(() => snapshot.value.context.currentNetwork)
	const balances = computed(() => snapshot.value.context.balances)

	const balances2 = useSelector(actorRef, (state) => state.context.balances)

	const walletLoaded = computed(
		() =>
			snapshot.value.matches("READY") ||
			snapshot.value.matches("SWITCHING_NETWORK") ||
			snapshot.value.matches("FETCHING_BALANCE")
	)

	onMounted(() => {
		if (snapshot.value.matches("INIT")) {
			send({ type: "Connect" })
		}
	})

	return {
		send,
		getPublicKey,
		snapshot,
		actorRef,
		address,
		displayAddress,
		currentNetwork,
		balances,
		balances2,
		walletLoaded
	}
})
