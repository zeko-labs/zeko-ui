<script lang="ts" setup>
import type { Networks } from "@lumina-dex/sdk"
const { network, icon = false } = defineProps<{
	network: Networks
	icon?: boolean
}>()
const friendlyNetwork = (n: string) => {
	const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
	const words = n.split(":") as [string, string]
	return `${capitalize(words[0])} ${capitalize(words[1])}`
}
</script>
<template>
  <div class="NetworkBadge">
    <template v-if="icon">
      <SvgMinaLogo v-if='network.includes("mina")' />
      <SvgZekoToken v-else />
    </template>
    <span class="network"> {{ friendlyNetwork(network) }}</span>
  </div>
</template>
<style lang="postcss" scoped>
.NetworkBadge {
  display: flex;
  gap: 0.5ch;
  width: fit-content;
  border-radius: 2rem;
  svg {
    --size: 1.5rem;
    height: var(--size);
    width: var(--size);
  }
}
.network {
  display: flex;
  place-items: center;
  font-size: var(--typography_fluid-lexend-m);
  font-weight: 400;
}
</style>
