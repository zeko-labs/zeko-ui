<script lang="ts" setup>
// import { useSelector } from "@xstate/vue"
import { useSelector } from "~/composables/useXstate"

// import { useMyCount } from "~/composables/useMyCount"

// const { inc, dec, count } = useMyCount()
const { snapshot, actorRef } = toRefs(useWalletStore())

const minaBalances2 = useSelector(actorRef, (state) => {
	console.log("COMPARING ...", state.context.minaBalances)
	return snapshot.value.context.minaBalances
})

const testSelector = useSelector(actorRef, (state) => {
	console.log("COMPARING ...", state.context.testArray)
	return state.context.testArray
})

// const minaBalances3 = computed(
// 	() => {
// 		console.log("Computing", snapshot.value.context)
// 		return [...snapshot.value.context.minaBalances.values()]
// 	},
// 	{
// 		onTrack: (event) => {
// 			console.log("Tracking", event)
// 		},
// 		onTrigger: (event) => {
// 			console.log("Triggering", event)
// 		}
// 	}
// )

// watch(
// 	() => snapshot.value,
// 	(newValue, oldValue) => {
// 		console.log(
// 			"Snapshot updated in component:",
// 			[...newValue.context.minaBalances.values()],
// 			[...oldValue.context.minaBalances.values()]
// 		)
// 	},
// 	{ deep: true }
// )

// const test = computed(() => snapshot.value)
</script>

<template>
  <h2>Test</h2>
  <hr />
  <!-- <pre v-show="true">{{ snapshot.value }}</pre> -->
  <!-- {{ value }} -->
  {{ minaBalances2 }}
  <hr />
  <!-- {{ testSelector }} -->
  <!-- {{ minaBalances3 }} -->
  <hr />
  <!-- {{ test }} -->
  <!-- {{ snapshot }} -->
  <hr />
  <!-- 
  {{ count }}
  <button @click="inc">Increment</button>
  <button @click="dec">Decrement</button> -->
</template>
