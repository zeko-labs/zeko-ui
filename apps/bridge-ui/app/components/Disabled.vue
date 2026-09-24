<script lang="ts" setup>
import { errorToaster } from "~/helpers"

const bs = useBridgeStore()
const unsupportedBrowser = computed(() => {
	const ua = navigator.userAgent
	return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Edge/i.test(ua)
})
const noWalletExtension = computed(() =>
	bs.wallet.snapshot.matches("UNSUPPORTED")
)
const notConnected = computed(() => !bs.walletLoaded)
const error = computed(() => bs.bridge.snapshot.matches("ERROR"))
onMounted(async () => {
	await nextTick()
	if (unsupportedBrowser.value) {
		errorToaster.create({
			title: "Unsupported Browser",
			description:
				"The Rollup Bridge is not supported on Safari. Please use a different browser, such as Chrome or Firefox.",
			type: "error",
			duration: Number.POSITIVE_INFINITY
		})
		return
	}
	if (noWalletExtension.value) {
		errorToaster.create({
			title: "No Wallet Extension",
			description:
				"Please install the Auro Wallet extension to use the Rollup Bridge.",
			type: "error",
			duration: Number.POSITIVE_INFINITY
		})
		return
	}
	if (error.value) {
		errorToaster.create({
			title: "Bridge Error",
			description:
				"An error has occurred with the bridge. Please try again later.",
			type: "error",
			duration: Number.POSITIVE_INFINITY
		})
		return
	}
})
</script>
<template>
  <div class="Disabled">
    <p>
      This legacy bridge transfers MINA between Mina and Zeko-M. For the
      Ethereum rollup and ETH or ERC-20 bridging, follow the current Zeko Docs.
    </p>
    <p>
      Please check <a href="https://docs.zeko.io">Zeko Docs</a> for more
      information.
    </p>
    <template v-if="unsupportedBrowser">
      <p>
        The Rollup Bridge is not supported on Safari. Please use a different
        browser, such as Chrome or Firefox.
      </p>
    </template>
    <template v-else-if="noWalletExtension">
      <p>
        Download and install the Auro Wallet extension to use the Rollup Bridge.
      </p>
      <a href="https://www.aurowallet.com" target="_blank">
        <Button variant="auro">Download AuroWallet</Button>
      </a>
    </template>
    <template v-else-if="notConnected">
      <p>Please connect your wallet to start bridging.</p>
      <Button variant="main" @click='bs.wallet.send({ type: "Connect" })'>
        Connect Wallet
      </Button>
    </template>
    <template v-else-if="error">
      <p class="error">
        An error has occurred with the bridge. Please try again later.
      </p>
    </template>
  </div>
</template>
<style lang="postcss" scoped>
.Disabled {
  text-align: center;
  button {
    width: fit-content;
  }
}
.MainnetOnly {
  button {
    all: unset;
    text-decoration: underline;
    color: blue;
    cursor: pointer;
  }
}
.WalletConnection {
  display: grid;
  place-items: center;
  a {
    all: unset;
  }
}
.error {
  color: var(--palette-persianRed-500);
}
</style>
