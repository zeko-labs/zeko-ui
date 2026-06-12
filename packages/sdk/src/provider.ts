import type { ProviderError } from "@aurowallet/mina-provider"

export type AuroProvider = {
	requestAccounts: () => Promise<string[] | ProviderError>
	requestNetwork: () => Promise<{ networkID: string } | ProviderError>
	switchChain: (args: { networkID: string }) => Promise<{ networkID: string } | ProviderError>
	addChain: (args: { url: string; name: string }) => Promise<{ networkID: string } | ProviderError>
	on: {
		(event: "chainChanged", listener: (chainInfo: { networkID: string }) => void): void
		(event: "accountsChanged", listener: (accounts: string[]) => void): void
	}
	removeAllListeners: () => void
}

export const isProviderError = (value: unknown): value is ProviderError =>
	typeof value === "object" &&
	value !== null &&
	"code" in value &&
	typeof (value as { code: unknown }).code === "number"

export const getAuroProvider = () =>
	(globalThis as { window?: { mina?: AuroProvider } }).window?.mina
