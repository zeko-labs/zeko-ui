<script lang="ts" setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Wallet as WalletIcon } from "lucide-vue-next"
const bs = useBridgeStore()
const currentMina = computed(() => {
	return Number.parseFloat(
		bs.balances[bs.currentNetwork]?.MINA?.balance.toFixed(3) ?? "0"
	).toString()
})
</script>
<template>
  <div class="Wallet">
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
  gap: 1ch;
  div {
    display: flex;
    align-items: center;
  }
  .Mina {
    gap: 0.5ch;
  }
  .Address {
    gap: 0.5ch;
  }
}
</style>
