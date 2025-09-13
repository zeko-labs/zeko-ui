import * as Sentry from "@sentry/nuxt"

export default defineNuxtPlugin(() => {
	const walletName = () => {
		if (window?.mina?.isAuro) return "auro"
		if (window?.mina) return "unknown"
		return "no-wallet"
	}
	Sentry.setTag("mina_wallet", walletName())
})
