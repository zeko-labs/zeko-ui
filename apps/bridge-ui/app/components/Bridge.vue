<script lang="ts" setup>
import { useMachine, useSelector } from "@lumina-dex/sdk/vue"
import { bridgeMachine } from "~~/machines/bridge"
import { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const wallet = useWalletStore()
const { address, walletLoaded, balances, currentNetwork } = storeToRefs(wallet)

const amountToBridge = ref("")
const walletValue = computed(() => wallet.snapshot.context)
const totalBalances = computed(() => {
	return `MINA: (L1) => ${JSON.stringify(balances.value["mina:devnet"])} | L2 => ${JSON.stringify(balances.value["zeko:testnet"])}`
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
			actors: {}
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
    {{ balances }}
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
