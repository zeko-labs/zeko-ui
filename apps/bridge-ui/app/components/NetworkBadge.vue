<script lang="ts" setup>
import {
	formatUserFacingNetworkLabel,
	MINA_NETWORKS,
	type WalletZekoNetwork
} from "@zeko/networks"
import type { BridgeNetwork } from "~~/machines/networks"

const { network, icon = false } = defineProps<{
	network: BridgeNetwork | WalletZekoNetwork
	icon?: boolean
}>()

const isMinaNetwork = (value: BridgeNetwork | WalletZekoNetwork) =>
	value === MINA_NETWORKS.devnet || value === MINA_NETWORKS.mainnet
</script>
<template>
  <div class="NetworkBadge">
    <template v-if="icon">
      <SvgMinaLogo v-if="isMinaNetwork(network)" />
      <SvgZekoToken v-else />
    </template>
    <span class="network"> {{ formatUserFacingNetworkLabel(network) }}</span>
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
