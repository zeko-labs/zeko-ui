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
  <div class="NetworkBadge">
    <SvgMinaLogo v-if='network.includes("mina")' />
    <SvgZekoToken v-else />
    <span class="network"> {{ friendlyNetwork(network) }}</span>
  </div>
</template>
<style lang="postcss" scoped>
.NetworkBadge {
  display: flex;
  gap: 0.5ch;
  width: fit-content;
  border-radius: 2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--colors-alpha-soft-gray1);
  svg {
    --size: 1.5rem;
    height: var(--size);
    width: var(--size);
  }
}
.network {
  display: flex;
  place-items: center;
  font-size: var(--fonts-lexend-typescale-scale-s);
  font-weight: 600;
}
</style>
