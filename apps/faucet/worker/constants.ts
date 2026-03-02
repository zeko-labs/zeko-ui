export const INSTANCE_COUNT = 3
export const DEFAULT_CHAIN = "zeko-testnet"
export const CLAIM_AMOUNT = "10"
export const GITHUB_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const GITHUB_CLAIM_WINDOW_SECONDS = 24 * 60 * 60
export const DEFAULT_BAN_TTL_SECONDS = 24 * 60 * 60
export const MUTEX_LEASE_MS = 30_000
export const MUTEX_STORAGE_KEY = "lease"
export const MUTEX_ACQUIRE_ATTEMPTS = 3

export const getExplorerUrl = (hash: string) =>
	`https://zekoscan.io/testnet/tx/${hash}/txInfo?type=zk-tx`
