/// <reference types="vite-plugin-comlink/client" />

import "@total-typescript/ts-reset"
import type Mina from "@aurowallet/mina-provider"

declare global {
	interface Window {
		mina: Mina
	}
	interface Navigator {
		standalone?: boolean
	}
}
