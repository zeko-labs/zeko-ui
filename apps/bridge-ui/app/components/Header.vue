<script lang="ts" setup>
import {
	BellOffIcon,
	BellRingIcon,
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	WalletIcon
} from "lucide-vue-next"

const bs = useBridgeStore()
const n = useNotificationStore()

const currentMina = computed(() => {
	return Number.parseFloat(
		bs.balances[bs.currentNetwork]?.MINA?.balance.toFixed(3) ?? "0"
	).toString()
})
const granted = computed(() => n.notificationPermission === "granted")
const walletExplorerUrl = computed(() => {
	if (!bs.address) return null
	if (
		bs.currentNetwork === "zeko:mainnet" ||
		bs.currentNetwork === "zeko-m:mainnet"
	) {
		return `https://zekoscan.io/mainnet/account/${bs.address}`
	}
	if (bs.currentNetwork === "mina:mainnet") {
		return `https://minascan.io/mainnet/account/${bs.address}`
	}
	return null
})
const copiedAddress = ref(false)
let copiedAddressTimeout: ReturnType<typeof setTimeout> | null = null

const copyAddress = async () => {
	if (!bs.address) return
	await navigator.clipboard.writeText(bs.address)
	copiedAddress.value = true
	if (copiedAddressTimeout) clearTimeout(copiedAddressTimeout)
	copiedAddressTimeout = setTimeout(() => {
		copiedAddress.value = false
		copiedAddressTimeout = null
	}, 1500)
}
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
      <NuxtLink to="/"> <SvgZekoLogoRings /> </NuxtLink>
    </div>
    <div class="MinaNetwork Badge">
      <div class="Network"><NetworkBadge :network="bs.currentNetwork" /></div>
      <div class="Mina" @click="refetchBalance">
        <span> {{ currentMina }} </span>
        <SvgMinaLogo width="24" height="24" />
        <span>MINA</span>
      </div>
    </div>
    <div class="Address Badge" :title="bs.address">
      <WalletIcon />
      <span> {{ bs.displayAddress }} </span>
      <span v-if="bs.address" class="AddressActions">
        <button
          type="button"
          class="AddressActionButton"
          :aria-label='
            copiedAddress
            ? "Copied wallet address"
            : `Copy wallet address ${bs.address}`
          '
          :title='copiedAddress ? "Copied" : "Copy address"'
          @click="copyAddress">
          <CheckIcon v-if="copiedAddress" class="CopiedIcon" />
          <CopyIcon v-else />
        </button>
        <a
          v-if="walletExplorerUrl"
          class="AddressActionButton"
          :href="walletExplorerUrl"
          :aria-label="`Open wallet address ${bs.address} in explorer`"
          title="Open in explorer"
          target="_blank"
          rel="noopener noreferrer">
          <ExternalLinkIcon />
        </a>
      </span>
    </div>
    <div
      class="Notifications Badge"
      :class="n.notificationPermission"
      :title='`Notifications are ${granted ? "enabled" : "disabled"}.`'>
      <BellRingIcon v-if="granted" />
      <button @click="n.toggle" v-else><BellOffIcon /></button>
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
  color: var(--palette-gray-950);
  text-decoration: none;
  &:hover,
  &:focus-within {
    .AddressActions {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.AddressActions {
  display: inline-flex;
  gap: 0.2rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

@keyframes CopiedCheckFade {
  0%,
  65% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.82);
  }
}

.AddressActionButton {
  inline-size: 1.65rem;
  block-size: 1.65rem;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--theme-light-border-secondary);
  border-radius: 999px;
  background: oklch(1 0 0 / 0.74);
  color: var(--theme-light-content-secondary);
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
  &:hover {
    background: var(--theme-light-background-secondary);
    color: var(--theme-light-content-primary);
    border-color: var(--palette-yellow-200);
  }
  &:focus-visible {
    opacity: 1;
    outline: 2px solid var(--palette-yellow-200);
    outline-offset: 2px;
  }
  svg {
    inline-size: 0.9rem;
    block-size: 0.9rem;
  }
  .CopiedIcon {
    color: var(--theme-light-content-primary);
    animation: CopiedCheckFade 1500ms ease both;
  }
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
