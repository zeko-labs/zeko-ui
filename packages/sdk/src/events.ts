import type { AuroWalletNetwork } from "@zeko/networks"

import type { Balance, CustomToken } from "./balance"

export type WalletEvent =
	| { type: "RequestNetworkChange"; network: AuroWalletNetwork }
	| { type: "WalletExtensionChangedNetwork"; network: AuroWalletNetwork }
	| { type: "Connect" }
	| { type: "Disconnect" }
	| { type: "SetAccount"; account: string }
	| { type: "FetchBalance"; network: AuroWalletNetwork; tokens: CustomToken[] }
	| { type: "FetchBalanceSuccess"; balances: Partial<Balance>; id: string }
	| { type: "FetchBalanceFailure"; id: string }
	| { type: "WalletExtensionNotDetected" }

export type WalletEmit =
	| { type: "NetworkChanged"; network: AuroWalletNetwork }
	| { type: "AccountChanged"; account: string }
	| { type: "NoMinaWalletDetected" }
