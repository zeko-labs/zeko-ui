<script lang="ts" setup>
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ActorRefFromLogic } from "xstate"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"

const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()
const machine = useSelector(operation, (state) => state)
const stateValue = computed(() => machine.value.value)
</script>
<template>
  <div>{{ stateValue }}</div>
  <div>{{ machine.context.changeNetworkTo }}</div>
  <div>{{ machine.context.returnTo }}</div>
</template>
