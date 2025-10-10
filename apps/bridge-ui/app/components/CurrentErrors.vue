<script setup lang="ts">
import { useSelector } from "@lumina-dex/sdk/vue"
import type { ActorRefFromLogic } from "xstate"
import { errorToaster } from "~/helpers"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
const { operation } = defineProps<{
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
}>()

const errors = useSelector(operation, (state) => state.context.errors)

watch(errors, (newErrors) => {
	if (newErrors) {
		const [e] = newErrors.toReversed()
		if (e) {
			console.error(`A total of ${newErrors.length} errors have occurred.`)
			errorToaster.create({
				title: "Error",
				description: e.message,
				type: "error",
				duration: Number.POSITIVE_INFINITY
			})
		}
	}
})
</script>
<template>
  <Toast :toaster="errorToaster" />
</template>
