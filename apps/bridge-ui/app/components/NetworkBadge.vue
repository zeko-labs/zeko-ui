<script lang="ts" setup>
import type { Networks } from "@lumina-dex/sdk"
const { network } = defineProps<{ network: Networks }>()
const friendlyNetwork = (n: string) => {
	const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
	const words = n.split(":") as [string, string]
	return `${capitalize(words[0])} ${capitalize(words[1])}`
}
</script>
<template>
  <span
    class="network"
    :class='network.includes("mina") ? "network-mina" : "network-zeko"'>
    {{ friendlyNetwork(network) }}
  </span>
</template>
<style lang="postcss" scoped>
/* Network label styles */
.network {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 999px;
  border: 1px solid transparent;
}
.network-mina {
  color: #501a5d;
  background: #f9ebff;
  border-color: #f8bef2;
}
.network-zeko {
  color: #1d4044;
  background: #e6fffa;
  border-color: #b2f5ea;
}
</style>
