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
</script>
<template>
  <div class="Wallet">
    <div
      class="Notifications"
      :class="n.notificationPermission"
      :title='`Notifications are ${granted ? "enabled" : "disabled"}.`'>
      <BellRingIcon v-if="granted" />
      <button @click="n.toggle" v-else>
        <BellOffIcon />
      </button>
    </div>
    <div class="Mina">
      <span>
        {{ currentMina }}
      </span>
      <SvgMinaToken width="24" height="24" />
    </div>
    <div class="Network">
      <NetworkBadge :network="bs.currentNetwork" />
    </div>
    <div class="Address" :title="bs.address">
      <WalletIcon />
      <span>
        {{ bs.displayAddress }}
      </span>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Wallet {
  display: flex;
  gap: 2ch;
  align-items: center;
  div {
    display: flex;
    place-items: center;
  }
  .Notifications {
    @media (max-width: 1024px) {
      display: none;
    }
    button {
      all: unset;
      cursor: pointer;
      display: flex;
      place-items: center;
    }
    &.granted {
      color: var(--colors-cosmicGold-medium);
    }
    &.denied {
      color: var(--colors-persianRed-400);
    }
    &.default {
      color: var(--colors-persianRed-400);
    }
  }
  .Mina {
    gap: 0.5ch;
  }
  .Address {
    gap: 0.5ch;
  }
  .Network {
    @media (max-width: 1024px) {
      display: none;
    }
  }
}
</style>
