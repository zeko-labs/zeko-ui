<script lang="ts" setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { BellOffIcon, BellRingIcon, WalletIcon } from "lucide-vue-next"
const bs = useBridgeStore()
const n = useNotificationStore()

const currentMina = computed(() => {
	return Number.parseFloat(
		bs.balances[bs.currentNetwork]?.MINA?.balance.toFixed(3) ?? "0"
	).toString()
})
const granted = computed(() => n.notificationPermission === "granted")
const refetchBalance = () => {
	bs.wallet.send({
		type: "FetchBalance",
		network: bs.currentNetwork,
		tokens: []
	})
}
</script>
<template>
  <header>
    <div class="Logo">
      <NuxtLink to="/">
        <SvgZekoLogoRings />
      </NuxtLink>
    </div>
    <div class="MinaNetwork Badge">
      <div class="Network">
        <NetworkBadge :network="bs.currentNetwork" />
      </div>
      <div class="Mina" @click="refetchBalance">
        <span>
          {{ currentMina }}
        </span>
        <SvgMinaLogo width="24" height="24" />
        <span>MINA</span>
      </div>
    </div>
    <div class="Address Badge" :title="bs.address">
      <WalletIcon />
      <span>
        {{ bs.displayAddress }}
      </span>
    </div>
    <div
      class="Notifications Badge"
      :class="n.notificationPermission"
      :title='`Notifications are ${granted ? "enabled" : "disabled"}.`'>
      <BellRingIcon v-if="granted" />
      <button @click="n.toggle" v-else>
        <BellOffIcon />
      </button>
    </div>
  </header>
</template>
<style lang="postcss" scoped>
header {
  position: relative;
  z-index: -1;
  background: var(--palette-gray-50);
  backdrop-filter: blur(4px);
  display: grid;
  grid-template-areas: "logo mina-network address notifications";
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  padding: 1rem var(--page-padding);
  max-width: 100vw;
  @media (max-width: 1024px) {
    grid-template-areas:
      "logo address notifications"
      ".  mina-network mina-network";
    grid-template-columns: 1fr auto auto;
    grid-template-rows: auto auto;
    gap: 1rem 0.5rem;
  }
}

.Badge {
  display: flex;
  align-items: center;
  justify-self: end;
  width: fit-content;
  gap: 1ch;
  height: 100%;
  padding: 0.25rem 0.75rem;
  background-color: white;
  border-radius: 0.5rem;
  transition: transform 0.2s;
  &:hover {
    transform: scale(1.05);
  }
}

.Logo {
  grid-area: logo;
  width: 79px;
  height: 48px;
}

.MinaNetwork {
  grid-area: mina-network;
  .Mina {
    display: flex;
    place-items: center;
    gap: 0.5ch;
    border-left: 1px solid var(--palette-alpha-soft-gray1);
    padding-left: 1ch;
  }
}

.Address {
  grid-area: address;
  gap: 0.5ch;
}

.Notifications {
  grid-area: notifications;
  button {
    all: unset;
    cursor: pointer;
    display: flex;
    place-items: center;
  }
  color: var(--palette-gray-950);
  /* &.granted {
    color: var(--palette-cosmicGold-medium);
  }
  &.denied {
    color: var(--palette-persianRed-400);
  }
  &.default {
    color: var(--palette-persianRed-400);
  } */
}
</style>
