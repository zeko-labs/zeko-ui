<script setup lang="ts">
import {
	type DisplayNetwork,
	formatUserFacingNetworkLabel
} from "@zeko/networks"

const props = defineProps<{
	network: DisplayNetwork
}>()
</script>

<template>
  {{ formatUserFacingNetworkLabel(props.network) }}
</template>
