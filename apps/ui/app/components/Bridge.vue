<script lang="ts" setup>
import { useMachine, useSelector } from "@lumina-dex/sdk/vue"
import { fromPromise } from "xstate"
import { bridgeMachine } from "~~/machines/bridge"
import { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const wallet = useWalletStore()
const { address, walletLoaded, minaBalances, zekoBalances, currentNetwork } =
	storeToRefs(wallet)

const {
	proveTransferRequest,
	confirmTransferRequest,
	findAllTransfers,
	findSyncedTransfers,
	proveTransferClaim,
	confirmTransferClaim
} = useBridge()

const amountToBridge = ref("")
const walletValue = computed(() => wallet.snapshot.context)
const totalBalances = computed(() => {
	return `MINA: (L1) => ${JSON.stringify(minaBalances.value)} | L2 => ${JSON.stringify(zekoBalances.value)}`
})
// const totalBalances = useSelector(walletActorRef, (state) => {
// 	return `MINA: (L1) => ${state.context.minaBalances.MINA} | L2 => ${state.context.zekoBalances.MINA}`
// })

// const totalBalances = computed(
// 	() =>
// 		`MINA: (L1) => ${minaBalances.value.get("mina")} | L2 => ${zekoBalances.value.get("mina")}`
// )

// const minaBalanceTest = computed(() => minaBalances.value)

const machine = bridgeMachine.provide({
	actors: {
		bridgeOperationMachine: bridgeOperationMachine.provide({
			actors: {
				proveTransferRequest: fromPromise(
					async ({ input: { direction, amount } }) => {
						console.log("ProveTransferRequest ...", direction, amount)
						const result = await proveTransferRequest({
							recipient: address.value,
							amount,
							direction
						})
						return result
					}
				),
				confirmTransferRequest: fromPromise(
					async ({ input: { accountUpdates } }) => {
						console.log("ConfirmTransferRequest ...")
						const result = await confirmTransferRequest({
							senderPublicKey: wallet.getPublicKey(address.value),
							amount: amountToBridge.value,
							accountUpdates
						})
						if ("hash" in result) return result.hash
						throw new Error("Error confirming transfer request")
					}
				),
				findAllTransfers: fromPromise(async () => {
					console.log("Finding all transfers ...")
					const transfers = await findAllTransfers({
						senderPublicKey: wallet.getPublicKey(address.value),
						amount: Number(amountToBridge.value)
					})
					return transfers
				}),
				findSyncedTransfers: fromPromise(
					async ({ input: { afterAll, transfer } }) => {
						console.log("Finding deposits ...")
						const deposits = await findSyncedTransfers({ afterAll, transfer })
						return deposits
					}
				),
				proveTransferClaim: fromPromise(
					async ({ input: { after, direction } }) => {
						console.log("ProveTransferClaim ...")
						const isNew = true //TODO: How do we find this out ?
						// biome-ignore lint/suspicious/noExplicitAny: TODO
						const before = [] as any[] //TODO: See with Martin
						const accountUpdates = await proveTransferClaim({
							after,
							before,
							recipient: address.value,
							amount: amountToBridge.value,
							direction
						})
						return accountUpdates
					}
				),
				confirmTransferClaim: fromPromise(
					async ({ input: { accountUpdates } }) => {
						console.log("ConfirmTransferClaim ...")
						const result = await confirmTransferClaim({
							senderPublicKey: wallet.getPublicKey(address.value),
							accountUpdates
						})
						if ("hash" in result) return result.hash
						throw new Error("Error confirming transfer request")
					}
				)
			}
		})
	}
})

//MOCK
const { send, snapshot, actorRef } = useMachine(bridgeMachine, {
	input: { wallet: wallet.actorRef, currentNetwork: currentNetwork.value },
	inspect: (event) => {
		if (event.type === "@xstate.event") {
			// console.log(event)
		}
	}
})

//PROD
// const { send, snapshot, actorRef } = useMachine(machine, {
// 	input: {} //Pass some initial state.
// })

// actorRef.subscribe((state) => {
// 	console.log("State", state.context)
// })

const source = computed(() => snapshot.value.context.sourceNetwork)
const destination = computed(() => snapshot.value.context.destinationNetwork)

const network = useSelector(
	wallet.actorRef,
	(state) => state.context.currentNetwork
)

const children = useSelector(actorRef, (state) => [
	...state.context.operations.values()
])
</script>
<template>
  <hr />

  <div :data-xstate="walletValue" v-show="walletLoaded">
    <!-- <h2>Bridge</h2>
    <hr>
    <h3>Instructions :</h3>
    <p>1. Chose a source and a destination</p>
    <p>2. Select and deposit your tokens from the source network.</p>
    <p>3. Withdraw your tokens from the destination network.</p>
    <hr /> -->
    Sending {{ amountToBridge }} from {{ source }}
    to {{ destination }}
    <hr />
    XState: {{ snapshot.value }}
    Children :
    <ul>
      <li v-for="(child, index) of children" :key="index">
        <template v-if="child">
          <Operation :operation="child.operation" />
        </template>
      </li>
    </ul>
    <hr />
    XState current Network : {{ network }}
    Computed:
    {{ minaBalances }}
    <hr />
    Source: {{ source }}
    <Button @click='send({ type: "InvertDirection" })'><==></Button>
    Destination:
    {{ destination }}
    <hr />
    <div>
      <p>Amount to bridge :</p>
      <fieldset role="group">
        <Button disabled>Mina</Button>
        <input v-model="amountToBridge" type="text" />
        <input type="submit" disabled v-model="totalBalances" />
      </fieldset>

      <hr />

      <div role="group">
        <!-- <button v-if="canBridge" @click="startBridge">Bridge</button> -->
        <!-- <button v-if="canClaim" @click="confirm">Claim</button> -->
        <!-- <button @click='send({ type: "BridgeToMina" })'>BridgeToMina</button> -->
        <!-- <button @click='send({ type: "BridgeToZeko" })'>BridgeToZeko</button> -->
      </div>
      <hr />
      <Button
        v-if='snapshot.matches("READY")'
        @click='send({ type: "StartOperation", amount: amountToBridge })'>
        Bridge
      </Button>
    </div>
  </div>
</template>
