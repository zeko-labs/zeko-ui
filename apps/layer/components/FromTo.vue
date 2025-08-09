<script lang="ts" setup>
const from = ref<Blockchains>("MINA L1")
const to = ref<Blockchains>("ZEKO L2")

type Blockchains = "MINA L1" | "ZEKO L2"

const swap = () => {
	const temp = from.value
	from.value = to.value
	to.value = temp
}
</script>
<template>
  <InputField :current-value="from" @invert-chains="swap" />
  <hr />

  <InputField :current-value="to" @invert-chains="swap" />
  <hr />

  <button @click="swap">Swap</button>
</template>
