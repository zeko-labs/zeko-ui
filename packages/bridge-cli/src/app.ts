import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { constants, readFileSync } from "node:fs"
import { access, appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
	Bridge,
	isInsufficientFirstWithdrawalAmountError,
	type Config
} from "@zeko-labs/bridge-sdk"
import { defineCommand, type CommandDef } from "citty"
import { config as loadDotenvConfig } from "dotenv"
import {
	PrivateKey,
	PublicKey,
	type Transaction as MinaTransaction,
	UInt32,
	UInt64,
	fetchTransactionStatus
} from "o1js"

export type ChainFamily = "mina" | "zeko" | "eth"
export type NetworkTier = "testnet" | "mainnet"
export type ChainRef = `${ChainFamily}:${NetworkTier}`
export type Direction = "deposit" | "withdrawal"
export type OperationStatus = "running" | "completed" | "cancelled" | "failed"
export type OperationPhase =
	| "initializing"
	| "submitted"
	| "waiting-submission"
	| "waiting-prior-claims"
	| "waiting-finalization"
	| "retrying"
	| "finalizing"
	| "canceling"
	| "completed"
	| "cancelled"
	| "failed"

export type DepositStatus = {
	index: number
	amount: string
	recipient: string
	cancelled: boolean
	cancellable?: boolean
	synced: boolean
	accepted: boolean
	confirmed: boolean
	finalised: boolean
	hash: string
	timestamp: string
}

export type WithdrawalStatus = {
	index: number
	amount: string
	recipient: string
	committed: boolean
	finalised: boolean
	hash: string
	timestamp: string
}

export type TransactionResult = {
	success: true
	direction: Direction
	action: "submit" | "finalize" | "cancel"
	route: `${ChainRef}->${ChainRef}`
	hash: string
	explorerUrl: string
	included: boolean
	zkAppId?: string
}

export type StatusResult<T> = {
	success: true
	direction: Direction
	route: `${ChainRef}->${ChainRef}`
	account: string
	count: number
	operations: T[]
}

export type BridgeCapabilityDiagnostic = {
	available: boolean
	reason: string | null
	status?: "available" | "alreadyFinalised" | "waiting" | "blocked"
	index?: number
}

type BridgeSdkOperation =
	| "submitDeposit"
	| "finalizeDeposit"
	| "cancelDeposit"
	| "submitWithdrawal"
	| "finalizeWithdrawal"
	| "getDepositStatuses"
	| "getWithdrawalStatuses"
	| "canFinalizeDeposit"
	| "canCancelDeposit"
	| "canFinalizeWithdrawal"

type BridgeSdkCallTrace = {
	operation: BridgeSdkOperation
	attempt: number
	startedAt: string
	endedAt: string
	durationMs: number
	success: boolean
	message?: string
	result?: string
}

type BridgeVerboseDiagnostics = {
	sdkCalls: BridgeSdkCallTrace[]
	sdkMethodStats: Partial<
		Record<
			BridgeSdkOperation,
			{
				count: number
				successCount: number
				errorCount: number
				totalDurationMs: number
				lastStartedAt?: string
				lastEndedAt?: string
				lastDurationMs?: number
				lastMessage?: string
				lastResult?: string
			}
		>
	>
	phaseTimings: Array<{
		phase: OperationPhase
		startedAt: string
		endedAt?: string
		durationMs: number
	}>
	waitReasons?: Partial<
		Record<
			"canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal",
			BridgeCapabilityDiagnostic
		>
	>
}

export type OperationLiveSnapshot = {
	refreshedAt: string
	nextAction: "wait" | "finalize" | "cancel" | "completed" | "cancelled"
	waitingOn?: "submission" | "prior-claims" | "finalization"
	targetIndex?: number
	claimableIndex?: number
	pendingAhead?: number
	canFinalize?: boolean
	canCancel?: boolean
	submitHash?: string
	observedCounts: {
		deposits: number
		withdrawals: number
	}
}

export type OperationSession = {
	id: string
	status: OperationStatus
	phase: OperationPhase
	route: `${ChainRef}->${ChainRef}`
	direction: Direction
	account: string
	recipient?: string
	amount: string
	logPath: string
	createdAt: string
	updatedAt: string
	timeoutSlots?: number
	lastError?: string
	targetIndex?: number
	pendingFinalizeIndex?: number
	pendingFinalizeSubmittedAt?: string
	pendingCancelMarker?: string
	queueAdvances?: number
	submittedTransactions: Array<{ action: "submit" | "finalize" | "cancel"; hash: string }>
	finalTransaction?: { action: "submit" | "finalize" | "cancel"; hash: string; explorerUrl: string }
	liveSnapshot?: OperationLiveSnapshot
	verboseDiagnostics?: BridgeVerboseDiagnostics
}

export type BridgeAdapter = {
	getDepositStatuses(account: string): Promise<DepositStatus[]>
	getWithdrawalStatuses(account: string): Promise<WithdrawalStatus[]>
	canFinalizeDeposit?(account?: string): Promise<boolean | BridgeCapabilityDiagnostic>
	canCancelDeposit?(account?: string): Promise<boolean | BridgeCapabilityDiagnostic>
	canFinalizeWithdrawal?(account?: string): Promise<boolean | BridgeCapabilityDiagnostic>
	submitDeposit(input: {
		account?: string
		recipient?: string
		amount: string
		timeoutSlots?: number
		wait: boolean
	}): Promise<TransactionResult>
	finalizeDeposit(input: { account?: string; wait: boolean }): Promise<TransactionResult>
	cancelDeposit(input: { account?: string; wait: boolean }): Promise<TransactionResult>
	submitWithdrawal(input: {
		account?: string
		recipient?: string
		amount: string
		wait: boolean
	}): Promise<TransactionResult>
	finalizeWithdrawal(input: { account?: string; wait: boolean }): Promise<TransactionResult>
}

export type BridgeAdapterFactory = (input: {
	from: ChainRef
	to: ChainRef
	verbose: boolean
}) => Promise<BridgeAdapter> | BridgeAdapter

export type AppPaths = {
	dataDir: string
	stateDir: string
	logDir: string
	cacheDir: string
}

export type SessionStore = ReturnType<typeof createSessionStore>

type RouteDescriptor = {
	from: ChainRef
	to: ChainRef
	enabled: boolean
	direction: Direction
	label: string
	reason?: string
}

type LogFn = (entry: {
	event: string
	phase: OperationPhase
	details?: Record<string, unknown>
}) => Promise<void>

type SignedTransactionResult = {
	hash?: string
	data?: { sendZkapp?: { zkapp?: { id?: string } } }
}

const APP_DIR_NAME = "zeko-bridge"
const NANOMINA_PER_MINA = 1_000_000_000n
const DEFAULT_BRIDGE_FEE_NANOMINA = 100_000_000n
const WITHDRAWAL_SUBMIT_FEE_NANOMINA = 500_000_000n
const DIRECT_MUTATION_RETRY_DELAY_MS = 5_000
const RETRY_SLEEP_MS = 5_000
const HEARTBEAT_INTERVAL_MS = 30_000
export const DEFAULT_DEPOSIT_TIMEOUT_SLOTS = 720
export const MAX_FEE_RETRIES = 5

export const KNOWN_ROUTES: RouteDescriptor[] = [
	{
		from: "mina:testnet",
		to: "zeko:testnet",
		enabled: true,
		direction: "deposit",
		label: "Mina testnet -> Zeko testnet"
	},
	{
		from: "zeko:testnet",
		to: "mina:testnet",
		enabled: true,
		direction: "withdrawal",
		label: "Zeko testnet -> Mina testnet"
	},
	{
		from: "mina:mainnet",
		to: "zeko:mainnet",
		enabled: false,
		direction: "deposit",
		label: "Mina mainnet -> Zeko mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko:mainnet",
		to: "mina:mainnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko mainnet -> Mina mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "eth:testnet",
		to: "zeko:testnet",
		enabled: false,
		direction: "deposit",
		label: "Ethereum testnet -> Zeko testnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko:testnet",
		to: "eth:testnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko testnet -> Ethereum testnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "eth:mainnet",
		to: "zeko:mainnet",
		enabled: false,
		direction: "deposit",
		label: "Ethereum mainnet -> Zeko mainnet",
		reason: "Known route, not enabled yet."
	},
	{
		from: "zeko:mainnet",
		to: "eth:mainnet",
		enabled: false,
		direction: "withdrawal",
		label: "Zeko mainnet -> Ethereum mainnet",
		reason: "Known route, not enabled yet."
	}
]

const CHAIN_REFS = [...new Set(KNOWN_ROUTES.flatMap(({ from, to }) => [from, to]))]

const TESTNET_CONFIG = {
	l1Url: "https://gateway.mina.devnet.zeko.io",
	l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io",
	zekoUrl: "https://testnet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql",
	actionsApi: "https://api.actions.zeko.io/graphql",
	l1Network: "testnet",
	l2Network: "testnet"
} as const satisfies Config

const MAINNET_CONFIG = {
	l1Url: "https://api.minascan.io/node/mainnet/v1/graphql",
	l1ArchiveUrl: "https://api.minascan.io/archive/mainnet/v1/graphql",
	zekoUrl: "https://mainnet.zeko.io/graphql",
	zekoArchiveUrl: "https://archive.mainnet.zeko.io/graphql",
	actionsApi: "https://api.actions.zeko.io/graphql",
	l1Network: "mainnet",
	l2Network: "mainnet"
} as const satisfies Config

const bridges = new Map<string, Promise<Bridge>>()

export const isChainRef = (value: string): value is ChainRef =>
	CHAIN_REFS.includes(value as ChainRef)

export const parseChainRef = (value: unknown, flag: string): ChainRef => {
	if (typeof value !== "string" || !isChainRef(value)) {
		throw new Error(`Invalid ${flag} chain: ${String(value)}`)
	}
	return value
}

export const parseRouteString = (value: string): [ChainRef, ChainRef] => {
	const [from, to] = value.split("->")
	if (!from || !to || !isChainRef(from) || !isChainRef(to)) {
		throw new Error(`Invalid persisted route: ${value}`)
	}
	return [from, to]
}

export const formatRoute = (from: ChainRef, to: ChainRef): `${ChainRef}->${ChainRef}` =>
	`${from}->${to}`

export const resolveRoute = (from: ChainRef, to: ChainRef): RouteDescriptor => {
	const route = KNOWN_ROUTES.find((candidate) => candidate.from === from && candidate.to === to)
	if (!route) throw new Error(`Unknown bridge route: ${from} -> ${to}`)
	return route
}

export const createSdkConfig = (
	route: RouteDescriptor,
	options: { verbose?: boolean } = {}
): Config => {
	if (!route.enabled) throw new Error(route.reason ?? `Bridge route ${route.label} is not enabled.`)
	if (route.from.includes("testnet") && route.to.includes("testnet")) {
		return { ...TESTNET_CONFIG, verbose: options.verbose === true }
	}
	if (route.from.includes("mainnet") && route.to.includes("mainnet")) {
		return { ...MAINNET_CONFIG, verbose: options.verbose === true }
	}
	throw new Error(`Unsupported network pairing for ${route.label}`)
}

export const minaStringToNanomina = (value: string): bigint => {
	const trimmed = value.trim()
	if (!/^\d+(?:\.\d{1,9})?$/.test(trimmed)) throw new Error(`Invalid MINA amount: ${value}`)
	const [wholePart = "0", fractionPart = ""] = trimmed.split(".")
	return BigInt(wholePart) * NANOMINA_PER_MINA + BigInt(fractionPart.padEnd(9, "0"))
}

const nanominaToMinaString = (value: bigint): string => {
	const whole = value / NANOMINA_PER_MINA
	const fraction = value % NANOMINA_PER_MINA
	return fraction === 0n
		? whole.toString()
		: `${whole.toString()}.${fraction.toString().padStart(9, "0").replace(/0+$/, "")}`
}

const normalizeStatusTimestamp = (timestamp: string): string => (timestamp === "0" ? "" : timestamp)

const formatErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

const readString = (args: Record<string, unknown>, name: string): string | undefined =>
	typeof args[name] === "string" && args[name].length > 0 ? args[name] : undefined

const readRequired = (
	args: Record<string, unknown>,
	name: string,
	message = `Missing required ${name}`
): string => {
	const value = readString(args, name)
	if (!value) throw new Error(message)
	return value
}

const readBoolean = (args: Record<string, unknown>, name: string, fallback = false): boolean =>
	typeof args[name] === "boolean" ? args[name] : fallback

const readAliasedString = (args: Record<string, unknown>, name: string, alias: string) =>
	readString(args, name) ?? readString(args, alias)

const readNumber = (
	args: Record<string, unknown>,
	name: string,
	flag: string
): number | undefined => {
	const value = readString(args, name)
	if (value === undefined) return undefined
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed < 0)
		throw new Error(`${flag} must be a non-negative number`)
	return parsed
}

const readAliasedNumber = (
	args: Record<string, unknown>,
	name: string,
	alias: string,
	flag: string
): number | undefined =>
	readString(args, name) ? readNumber(args, name, flag) : readNumber(args, alias, flag)

const sleepFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const resolveDepositTimeoutSlots = (value?: number): number =>
	value ?? DEFAULT_DEPOSIT_TIMEOUT_SLOTS

export const resolveSignerKeys = (
	env: Partial<Record<string, string | undefined>> = process.env
) => {
	const mina = env.MINA_PRIVATE_KEY ?? env.BRIDGE_PRIVATE_KEY
	const zeko = env.ZEKO_PRIVATE_KEY ?? mina
	const eth = env.ETH_PRIVATE_KEY
	if (!mina && !zeko && !eth) {
		throw new Error("Missing wallet private key. Set MINA_PRIVATE_KEY or BRIDGE_PRIVATE_KEY.")
	}
	return { mina, zeko, eth }
}

const deriveAccount = (from: ChainRef, explicit?: string): string => {
	if (explicit) return explicit
	const keys = resolveSignerKeys()
	const secret = from.startsWith("zeko:") ? keys.zeko : keys.mina
	if (!secret) throw new Error(`Missing required signer private key for ${from}`)
	return PrivateKey.fromBase58(secret).toPublicKey().toBase58()
}

export const resolveAppPaths = ({
	env = process.env,
	platform = process.platform
}: {
	env?: Partial<Record<string, string | undefined>>
	platform?: NodeJS.Platform
} = {}): AppPaths => {
	const home = env.HOME ?? os.homedir()
	if (platform === "darwin") {
		return {
			dataDir: path.join(home, "Library", "Application Support", APP_DIR_NAME),
			stateDir: path.join(home, "Library", "Application Support", APP_DIR_NAME, "state"),
			logDir: path.join(home, "Library", "Logs", APP_DIR_NAME),
			cacheDir: path.join(home, "Library", "Caches", APP_DIR_NAME)
		}
	}
	if (platform === "win32") {
		const appData = env.APPDATA ?? path.join(home, "AppData", "Roaming")
		const localAppData = env.LOCALAPPDATA ?? path.join(home, "AppData", "Local")
		return {
			dataDir: path.join(appData, APP_DIR_NAME),
			stateDir: path.join(localAppData, APP_DIR_NAME, "state"),
			logDir: path.join(localAppData, APP_DIR_NAME, "logs"),
			cacheDir: path.join(localAppData, APP_DIR_NAME, "cache")
		}
	}
	const dataRoot = env.XDG_DATA_HOME ?? path.join(home, ".local", "share")
	const stateRoot = env.XDG_STATE_HOME ?? path.join(home, ".local", "state")
	const cacheRoot = env.XDG_CACHE_HOME ?? path.join(home, ".cache")
	return {
		dataDir: path.join(dataRoot, APP_DIR_NAME),
		stateDir: path.join(stateRoot, APP_DIR_NAME),
		logDir: path.join(stateRoot, APP_DIR_NAME, "logs"),
		cacheDir: path.join(cacheRoot, APP_DIR_NAME)
	}
}

export const createSessionStore = ({ stateDir }: { stateDir: string }) => {
	const operationsDir = path.join(stateDir, "operations")
	const filePath = (id: string) => path.join(operationsDir, `${id}.json`)
	const ensureDir = () => mkdir(operationsDir, { recursive: true })
	return {
		async save(session: OperationSession): Promise<void> {
			await ensureDir()
			await writeFile(filePath(session.id), JSON.stringify(session, null, 2))
		},
		async load(id: string): Promise<OperationSession | null> {
			try {
				return JSON.parse(await readFile(filePath(id), "utf8")) as OperationSession
			} catch (error) {
				if (error instanceof Error && "code" in error && error.code === "ENOENT") return null
				throw error
			}
		},
		async list(): Promise<OperationSession[]> {
			await ensureDir()
			const files = (await readdir(operationsDir)).filter((file) => file.endsWith(".json"))
			const sessions = await Promise.all(
				files.map(
					async (file) =>
						JSON.parse(await readFile(path.join(operationsDir, file), "utf8")) as OperationSession
				)
			)
			return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
		}
	}
}

export const createOperationLogger = ({ logPath }: { logPath: string }) => ({
	async write(event: string, payload: Record<string, unknown> = {}): Promise<void> {
		await mkdir(path.dirname(logPath), { recursive: true })
		await appendFile(
			logPath,
			`${JSON.stringify({ timestamp: new Date().toISOString(), event, ...payload })}\n`
		)
	}
})

export const resolveBridgeCliDotenvPaths = ({
	homeDir = os.homedir(),
	cliModuleUrl = import.meta.url,
	argv = process.argv,
	cwd = process.cwd()
}: {
	homeDir?: string
	cliModuleUrl?: string
	argv?: string[]
	cwd?: string
} = {}): string[] => {
	const candidates = [path.join(homeDir, ".zeko", ".env")]
	const cliBinaryPath = fileURLToPath(cliModuleUrl)
	candidates.push(path.join(path.dirname(cliBinaryPath), ".env"))
	if (argv[1]) {
		const invocation = path.isAbsolute(argv[1]) ? argv[1] : path.resolve(cwd, argv[1])
		candidates.push(path.join(path.dirname(invocation), ".env"))
	}
	return [...new Set(candidates)]
}

export const loadBridgeCliEnv = async ({
	env = process.env,
	paths = resolveBridgeCliDotenvPaths(),
	canRead = async (filePath: string) => {
		try {
			await access(filePath, constants.R_OK)
			return true
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code
			if (code === "ENOENT" || code === "EACCES") return false
			throw error
		}
	},
	loadConfig = (filePath: string, processEnv: Record<string, string>) =>
		loadDotenvConfig({ path: filePath, processEnv, override: false, quiet: true })
}: {
	env?: Record<string, string | undefined>
	paths?: string[]
	canRead?: (filePath: string) => Promise<boolean>
	loadConfig?: (
		filePath: string,
		processEnv: Record<string, string>
	) => { parsed?: Record<string, string>; error?: Error }
} = {}): Promise<{ loadedPaths: string[] }> => {
	const loadedValues: Record<string, string> = {}
	const loadedPaths: string[] = []
	for (const filePath of paths) {
		if (!(await canRead(filePath))) continue
		const result = loadConfig(filePath, loadedValues)
		if (result.error) throw result.error
		loadedPaths.push(filePath)
	}
	for (const [key, value] of Object.entries(env)) {
		if (loadedValues[key] === undefined && value !== undefined) loadedValues[key] = value
	}
	Object.assign(env, loadedValues)
	return { loadedPaths }
}

const createExplorerUrl = (network: ChainRef, hash: string): string => {
	if (network.startsWith("zeko:")) return `https://zekoscan.io/testnet/tx/${hash}`
	if (network === "mina:mainnet") return `https://minascan.io/mainnet/tx/${hash}`
	return `https://minascan.io/devnet/tx/${hash}`
}

const routeKey = (route: RouteDescriptor, verbose: boolean) =>
	`${route.from}->${route.to}:verbose=${verbose ? "1" : "0"}`

const getBridge = (route: RouteDescriptor, verbose: boolean) => {
	const key = routeKey(route, verbose)
	const cached = bridges.get(key)
	if (cached) return cached
	const bridge = Bridge.init(createSdkConfig(route, { verbose })).catch((error: unknown) => {
		bridges.delete(key)
		throw error
	})
	bridges.set(key, bridge)
	return bridge
}

const resolvePublicKey = ({
	account,
	keys,
	network
}: {
	account?: string
	keys: ReturnType<typeof resolveSignerKeys>
	network: ChainRef
}) => {
	const secret = network.startsWith("zeko:")
		? keys.zeko
		: network.startsWith("eth:")
			? keys.eth
			: keys.mina
	if (!secret) throw new Error(`Missing required signer private key for ${network}`)
	const signer = PrivateKey.fromBase58(secret)
	return {
		publicKey: PublicKey.fromBase58(account ?? signer.toPublicKey().toBase58()),
		signer
	}
}

const waitForTransactionInclusion = async ({
	zkAppId,
	graphqlUrl
}: {
	zkAppId?: string
	graphqlUrl: string
}): Promise<boolean> => {
	if (!zkAppId) return false
	for (;;) {
		try {
			const status = await fetchTransactionStatus(zkAppId, graphqlUrl)
			if (status === "INCLUDED") return true
			if (status !== "PENDING") return false
			await sleepFor(2_000)
		} catch {
			return false
		}
	}
}

const isFeeTooLowError = (error: unknown): boolean => String(error).includes("Fee is too low")

export const sendWithFeeRetries = async <TTransaction, TResult>({
	createTransaction,
	initialFeeNanomina,
	sendTransaction
}: {
	createTransaction: (feeNanomina: bigint) => Promise<TTransaction>
	initialFeeNanomina: bigint
	sendTransaction: (transaction: TTransaction) => Promise<TResult>
}): Promise<TResult> => {
	let feeNanomina = initialFeeNanomina
	for (let retryCount = 0; ; retryCount += 1) {
		try {
			return await sendTransaction(await createTransaction(feeNanomina))
		} catch (error) {
			if (!isFeeTooLowError(error) || retryCount >= MAX_FEE_RETRIES) throw error
			feeNanomina *= 2n
		}
	}
}

const signSdkTransaction =
	(signer: PrivateKey) =>
	async (transaction: MinaTransaction<boolean, false>): Promise<MinaTransaction<boolean, true>> =>
		transaction.sign([signer]) as MinaTransaction<boolean, true>

const completedTx = (hash: string): SignedTransactionResult => ({ hash })

const useCompletedTx = async (
	transaction: SignedTransactionResult
): Promise<SignedTransactionResult> => transaction

const networkForAction = ({
	action,
	route
}: {
	action: "submit" | "finalize" | "cancel"
	route: RouteDescriptor
}): ChainRef => {
	if (route.direction === "deposit") return action === "finalize" ? route.to : route.from
	return action === "submit" ? route.from : route.to
}

const graphqlUrlForAction = ({
	action,
	route
}: {
	action: "submit" | "finalize" | "cancel"
	route: RouteDescriptor
}): string => {
	const config = createSdkConfig(route)
	return networkForAction({ action, route }).startsWith("zeko:") ? config.zekoUrl : config.l1Url
}

const normalizeTxResult = async ({
	action,
	direction,
	route,
	result,
	wait
}: {
	action: "submit" | "finalize" | "cancel"
	direction: Direction
	route: RouteDescriptor
	result: SignedTransactionResult
	wait: boolean
}): Promise<TransactionResult> => {
	if (!result.hash) throw new Error(`Transaction ${direction}:${action} did not return a hash`)
	const network = networkForAction({ action, route })
	const zkAppId = result.data?.sendZkapp?.zkapp?.id
	return {
		success: true,
		direction,
		action,
		route: formatRoute(route.from, route.to),
		hash: result.hash,
		explorerUrl: createExplorerUrl(network, result.hash),
		included: wait
			? await waitForTransactionInclusion({
					zkAppId,
					graphqlUrl: graphqlUrlForAction({ action, route })
				})
			: false,
		zkAppId
	}
}

export const createBridgeAdapter = ({
	route,
	env = process.env,
	verbose = false
}: {
	route: RouteDescriptor
	env?: Partial<Record<string, string | undefined>>
	verbose?: boolean
}): BridgeAdapter => {
	const keys = resolveSignerKeys(env)
	return {
		async getDepositStatuses(account) {
			const bridge = await getBridge(route, verbose)
			const result = await bridge.fetchDepositsWithStates(PublicKey.fromBase58(account))
			return result.deposits.map(
				(item): DepositStatus => ({
					index: item.index,
					amount: nanominaToMinaString(item.amount.toBigInt()),
					recipient: item.recipient.toBase58(),
					cancelled: item.cancelled,
					cancellable: item.cancellable,
					synced: item.synced,
					accepted: item.accepted,
					confirmed: item.confirmed,
					finalised: item.finalised,
					hash: item.hash,
					timestamp: normalizeStatusTimestamp(item.timestamp)
				})
			)
		},
		async getWithdrawalStatuses(account) {
			const bridge = await getBridge(route, verbose)
			const result = await bridge.fetchWithdrawalsWithStates(PublicKey.fromBase58(account))
			return result.withdrawals.map(
				(item): WithdrawalStatus => ({
					index: item.index,
					amount: nanominaToMinaString(item.amount.toBigInt()),
					recipient: item.recipient.toBase58(),
					committed: item.committed,
					finalised: item.finalised,
					hash: item.hash,
					timestamp: normalizeStatusTimestamp(item.timestamp)
				})
			)
		},
		async submitDeposit({ account, recipient, amount, timeoutSlots, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const { publicKey: recipientPublicKey } = resolvePublicKey({
				account: recipient,
				keys,
				network: route.to
			})
			const timeout = (await bridge.fetchCurrentSlot()).add(
				UInt32.from(resolveDepositTimeoutSlots(timeoutSlots))
			)
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.submitDeposit(
							{ sender: publicKey, fee: Number(feeNanomina) },
							{
								recipient: recipientPublicKey,
								amount: UInt64.from(minaStringToNanomina(amount)),
								timeout
							},
							signSdkTransaction(signer)
						)
					)
			})
			return normalizeTxResult({ action: "submit", direction: "deposit", route, result, wait })
		},
		async canFinalizeDeposit(account) {
			const bridge = await getBridge(route, verbose)
			return bridge.canFinalizeDeposit(
				resolvePublicKey({ account, keys, network: route.to }).publicKey
			)
		},
		async canCancelDeposit(account) {
			const bridge = await getBridge(route, verbose)
			return bridge.canCancelDeposit(
				resolvePublicKey({ account, keys, network: route.from }).publicKey
			)
		},
		async finalizeDeposit({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.to })
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.finalizeDeposit(publicKey, signSdkTransaction(signer), { feeNanomina })
					)
			})
			return normalizeTxResult({ action: "finalize", direction: "deposit", route, result, wait })
		},
		async cancelDeposit({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.cancelDeposit(publicKey, signSdkTransaction(signer), undefined, {
							feeNanomina
						})
					)
			})
			return normalizeTxResult({ action: "cancel", direction: "deposit", route, result, wait })
		},
		async submitWithdrawal({ account, recipient, amount, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.from })
			const { publicKey: recipientPublicKey } = resolvePublicKey({
				account: recipient,
				keys,
				network: route.to
			})
			const result = await sendWithFeeRetries({
				initialFeeNanomina: WITHDRAWAL_SUBMIT_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.submitWithdrawal(
							{ sender: publicKey, fee: Number(feeNanomina) },
							{ recipient: recipientPublicKey, amount: UInt64.from(minaStringToNanomina(amount)) },
							signSdkTransaction(signer)
						)
					)
			})
			return normalizeTxResult({ action: "submit", direction: "withdrawal", route, result, wait })
		},
		async canFinalizeWithdrawal(account) {
			const bridge = await getBridge(route, verbose)
			return bridge.canFinalizeWithdrawal(
				resolvePublicKey({ account, keys, network: route.to }).publicKey
			)
		},
		async finalizeWithdrawal({ account, wait }) {
			const bridge = await getBridge(route, verbose)
			const { publicKey, signer } = resolvePublicKey({ account, keys, network: route.to })
			const result = await sendWithFeeRetries({
				initialFeeNanomina: DEFAULT_BRIDGE_FEE_NANOMINA,
				sendTransaction: useCompletedTx,
				createTransaction: async (feeNanomina) =>
					completedTx(
						await bridge.finalizeWithdrawal(publicKey, signSdkTransaction(signer), undefined, {
							feeNanomina
						})
					)
			})
			return normalizeTxResult({ action: "finalize", direction: "withdrawal", route, result, wait })
		}
	}
}

export const createDefaultBridgeAdapter: BridgeAdapterFactory = async ({ from, to, verbose }) =>
	createBridgeAdapter({ route: resolveRoute(from, to), verbose })

export const sortByIndex = <T extends { index: number }>(items: T[]): T[] =>
	[...items].sort((left, right) => left.index - right.index)

export const getSubmitHash = (session: OperationSession): string | undefined =>
	session.submittedTransactions.find((transaction) => transaction.action === "submit")?.hash

const resolveTargetIndex = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: Array<DepositStatus | WithdrawalStatus>
}): number | undefined => {
	const submitHash = getSubmitHash(session)
	if (submitHash) {
		const matchedIndex = statuses.find((status) => status.hash === submitHash)?.index
		if (matchedIndex !== undefined) return matchedIndex
		if (
			session.targetIndex !== undefined &&
			statuses.some((status) => status.index === session.targetIndex)
		) {
			return session.targetIndex
		}
		if (
			session.targetIndex !== undefined &&
			(session.finalTransaction || session.pendingFinalizeIndex === session.targetIndex)
		) {
			return session.targetIndex
		}
		return undefined
	}
	return (
		session.targetIndex ??
		(statuses.length > 0 ? Math.max(...statuses.map((status) => status.index)) : undefined)
	)
}

const findDepositTarget = (session: OperationSession, statuses: DepositStatus[]) => {
	const targetIndex = resolveTargetIndex({ session, statuses })
	if (targetIndex !== undefined) return statuses.find((status) => status.index === targetIndex)
	if (getSubmitHash(session)) return undefined
	const matches = statuses.filter(
		(status) =>
			status.amount === session.amount &&
			status.recipient === (session.recipient ?? session.account)
	)
	return matches.length === 1 ? matches[0] : statuses.length === 1 ? statuses[0] : undefined
}

const findWithdrawalTarget = (session: OperationSession, statuses: WithdrawalStatus[]) => {
	const targetIndex = resolveTargetIndex({ session, statuses })
	if (targetIndex !== undefined) return statuses.find((status) => status.index === targetIndex)
	if (getSubmitHash(session)) return undefined
	const matches = statuses.filter(
		(status) =>
			status.amount === session.amount &&
			status.recipient === (session.recipient ?? session.account)
	)
	return matches.length === 1 ? matches[0] : statuses.length === 1 ? statuses[0] : undefined
}

export type DepositQueueState = {
	target?: DepositStatus
	targetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	blockingAhead: number
	skippableAhead: number
	shouldAdvanceQueuedClaims: boolean
}

export type WithdrawalQueueState = {
	target?: WithdrawalStatus
	targetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	shouldAdvanceQueuedClaims: boolean
}

export const analyzeDepositQueue = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: DepositStatus[]
}): DepositQueueState => {
	const target = findDepositTarget(session, statuses)
	const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
	const claimableIndex = sortByIndex(statuses).find(
		(status) => status.confirmed && !status.finalised && !status.cancelled
	)?.index
	const pendingStatuses =
		targetIndex === undefined
			? []
			: statuses.filter(
					(status) => status.index < targetIndex && !status.finalised && !status.cancelled
				)
	const blockingAhead = pendingStatuses.filter((status) => status.cancellable !== true).length
	const skippableAhead = pendingStatuses.filter((status) => status.cancellable === true).length
	return {
		target,
		targetIndex,
		claimableIndex,
		pendingAhead: pendingStatuses.length,
		blockingAhead,
		skippableAhead,
		shouldAdvanceQueuedClaims:
			pendingStatuses.length > 0 || (target === undefined && claimableIndex !== undefined)
	}
}

export const analyzeWithdrawalQueue = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: WithdrawalStatus[]
}): WithdrawalQueueState => {
	const target = findWithdrawalTarget(session, statuses)
	const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
	const claimableIndex = sortByIndex(statuses).find(
		(status) => status.committed && !status.finalised
	)?.index
	const pendingAhead =
		targetIndex === undefined
			? 0
			: statuses.filter((status) => status.index < targetIndex && !status.finalised).length
	return {
		target,
		targetIndex,
		claimableIndex,
		pendingAhead,
		shouldAdvanceQueuedClaims:
			pendingAhead > 0 || (target === undefined && claimableIndex !== undefined)
	}
}

export const resolveEffectiveDepositClaimableIndex = ({
	claimableIndex,
	target,
	pendingAhead,
	canFinalize
}: {
	claimableIndex?: number
	target?: DepositStatus
	pendingAhead: number
	canFinalize: boolean
}): number | undefined =>
	claimableIndex ?? (canFinalize && pendingAhead === 0 && target ? target.index : undefined)

type Decision =
	| { action: "submit"; analysis: DepositQueueState }
	| {
			action: "wait"
			event: TransitionEvent
			signature: string
			details: Record<string, unknown>
			analysis: DepositQueueState | WithdrawalQueueState
	  }
	| {
			action: "finalize"
			claimableIndex?: number
			analysis: DepositQueueState | WithdrawalQueueState
	  }
	| { action: "cancel"; cancelMarker?: string; analysis: DepositQueueState }
	| { action: "complete"; analysis: DepositQueueState | WithdrawalQueueState }
	| { action: "cancelled"; analysis: DepositQueueState }

type TransitionEvent =
	| "MARK_SUBMITTED"
	| "MARK_WAITING_SUBMISSION"
	| "MARK_WAITING_PRIOR_CLAIMS"
	| "MARK_WAITING_FINALIZATION"
	| "MARK_RETRYING"
	| "MARK_FINALIZING"
	| "MARK_CANCELLING"
	| "MARK_COMPLETED"
	| "MARK_CANCELLED"
	| "MARK_FAILED"

const OPERATION_STATE_BY_EVENT = {
	MARK_SUBMITTED: { phase: "submitted", status: "running" },
	MARK_WAITING_SUBMISSION: { phase: "waiting-submission", status: "running" },
	MARK_WAITING_PRIOR_CLAIMS: { phase: "waiting-prior-claims", status: "running" },
	MARK_WAITING_FINALIZATION: { phase: "waiting-finalization", status: "running" },
	MARK_RETRYING: { phase: "retrying", status: "running" },
	MARK_FINALIZING: { phase: "finalizing", status: "running" },
	MARK_CANCELLING: { phase: "canceling", status: "running" },
	MARK_COMPLETED: { phase: "completed", status: "completed" },
	MARK_CANCELLED: { phase: "cancelled", status: "cancelled" },
	MARK_FAILED: { phase: "failed", status: "failed" }
} satisfies Record<TransitionEvent, { phase: OperationPhase; status: OperationStatus }>

const toPendingCancelMarker = ({
	currentTargetIndex,
	claimableIndex,
	pendingAhead,
	isCurrentTarget
}: {
	currentTargetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	isCurrentTarget: boolean
}): string =>
	isCurrentTarget
		? `current:${currentTargetIndex ?? "none"}`
		: `prior:${claimableIndex ?? "none"}:${pendingAhead}`

const capabilityDiagnostic = (
	value: boolean | BridgeCapabilityDiagnostic
): BridgeCapabilityDiagnostic =>
	typeof value === "boolean" ? { available: value, reason: null } : value

const capabilityAppliesToIndex = (
	diagnostic: BridgeCapabilityDiagnostic,
	index: number | undefined
): boolean => index !== undefined && (diagnostic.index === undefined || diagnostic.index === index)

const isAlreadyFinalisedWithdrawal = (diagnostic: BridgeCapabilityDiagnostic): boolean =>
	diagnostic.status === "alreadyFinalised" || diagnostic.reason === "Withdrawal already finalised"

const pendingFinalizeState = ({
	session,
	claimableIndex,
	now
}: {
	session: OperationSession
	claimableIndex?: number
	now: () => string
}) => {
	if (claimableIndex === undefined || session.pendingFinalizeIndex !== claimableIndex) {
		return { isPending: false, isStale: false }
	}
	if (!session.pendingFinalizeSubmittedAt) return { isPending: true, isStale: true }
	const submittedAt = Date.parse(session.pendingFinalizeSubmittedAt)
	const current = Date.parse(now())
	return {
		isPending: true,
		isStale: Number.isNaN(submittedAt) || Number.isNaN(current) || current - submittedAt >= 180_000
	}
}

export const decideDepositStep = ({
	session,
	statuses,
	canFinalize,
	canCancel,
	now = () => new Date().toISOString()
}: {
	session: OperationSession
	statuses: DepositStatus[]
	canFinalize: BridgeCapabilityDiagnostic
	canCancel: BridgeCapabilityDiagnostic
	now?: () => string
}): Decision => {
	const sorted = sortByIndex(statuses)
	const hasSubmittedDeposit = getSubmitHash(session) !== undefined
	const unresolved = sorted.filter((status) => !status.finalised && !status.cancelled)
	const analysis = analyzeDepositQueue({
		session: hasSubmittedDeposit ? session : { ...session, targetIndex: undefined },
		statuses: sorted
	})
	const { target, targetIndex, claimableIndex, pendingAhead, blockingAhead, skippableAhead } =
		analysis
	if (!hasSubmittedDeposit && unresolved.length === 0) return { action: "submit", analysis }
	if (hasSubmittedDeposit && target?.cancelled) return { action: "cancelled", analysis }
	if (hasSubmittedDeposit && target?.finalised) return { action: "complete", analysis }

	const effectiveClaimableIndex = resolveEffectiveDepositClaimableIndex({
		claimableIndex: canFinalize.index ?? claimableIndex,
		target,
		pendingAhead,
		canFinalize: canFinalize.available
	})
	const retry = pendingFinalizeState({
		session,
		claimableIndex: effectiveClaimableIndex ?? targetIndex,
		now
	})
	const currentCancelMarker = toPendingCancelMarker({
		currentTargetIndex: target?.index,
		claimableIndex,
		pendingAhead,
		isCurrentTarget: true
	})
	const priorCancelMarker = toPendingCancelMarker({
		currentTargetIndex: target?.index,
		claimableIndex,
		pendingAhead,
		isCurrentTarget: false
	})
	const shouldCancelCurrent =
		hasSubmittedDeposit &&
		target !== undefined &&
		pendingAhead === 0 &&
		!canFinalize.available &&
		canCancel.available &&
		session.pendingCancelMarker !== currentCancelMarker
	const shouldCancelPrior =
		canCancel.available &&
		(skippableAhead > 0 || (!hasSubmittedDeposit && target !== undefined && pendingAhead === 0)) &&
		session.pendingCancelMarker !== priorCancelMarker
	const shouldFinalize =
		canFinalize.available &&
		capabilityAppliesToIndex(canFinalize, effectiveClaimableIndex) &&
		(!retry.isPending || retry.isStale) &&
		skippableAhead === 0 &&
		!shouldCancelCurrent

	if (shouldFinalize)
		return { action: "finalize", analysis, claimableIndex: effectiveClaimableIndex }
	if (shouldCancelCurrent || shouldCancelPrior) {
		return {
			action: "cancel",
			analysis,
			cancelMarker: shouldCancelCurrent ? currentCancelMarker : priorCancelMarker
		}
	}
	if (analysis.shouldAdvanceQueuedClaims) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_PRIOR_CLAIMS",
			signature: `prior:${targetIndex ?? "unknown"}:${claimableIndex ?? "none"}:${pendingAhead}:${blockingAhead}:${skippableAhead}`,
			details: {
				waiting: "prior-claims",
				targetIndex,
				pendingAhead,
				blockingAhead,
				skippableAhead,
				claimIndex: effectiveClaimableIndex ?? claimableIndex
			}
		}
	}
	if (!target) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_SUBMISSION",
			signature: "submission:pending",
			details: { waiting: "submission", submitHash: getSubmitHash(session) }
		}
	}
	return {
		action: "wait",
		analysis,
		event: "MARK_WAITING_FINALIZATION",
		signature: `finalization:${target.index}:${claimableIndex ?? "none"}`,
		details: {
			waiting: "finalization",
			targetIndex: target.index,
			claimIndex: effectiveClaimableIndex ?? claimableIndex
		}
	}
}

export const decideWithdrawalStep = ({
	session,
	statuses,
	canFinalize,
	now = () => new Date().toISOString()
}: {
	session: OperationSession
	statuses: WithdrawalStatus[]
	canFinalize: BridgeCapabilityDiagnostic
	now?: () => string
}): Decision => {
	const analysis = analyzeWithdrawalQueue({ session, statuses: sortByIndex(statuses) })
	const { target, targetIndex, claimableIndex, pendingAhead, shouldAdvanceQueuedClaims } = analysis
	if (target?.finalised) return { action: "complete", analysis }
	if (
		target?.committed &&
		pendingAhead === 0 &&
		isAlreadyFinalisedWithdrawal(canFinalize) &&
		canFinalize.index === target.index
	) {
		return { action: "complete", analysis }
	}
	const retry = pendingFinalizeState({ session, claimableIndex, now })
	if (
		canFinalize.available &&
		claimableIndex !== undefined &&
		capabilityAppliesToIndex(canFinalize, claimableIndex) &&
		(!retry.isPending || retry.isStale) &&
		(shouldAdvanceQueuedClaims || claimableIndex === target?.index)
	) {
		return { action: "finalize", analysis, claimableIndex }
	}
	if (target && !target.committed && !shouldAdvanceQueuedClaims) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_SUBMISSION",
			signature: `submission:commit:${target.index}`,
			details: {
				waiting: "submission",
				targetIndex: target.index,
				submitHash: getSubmitHash(session)
			}
		}
	}
	if (shouldAdvanceQueuedClaims) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_PRIOR_CLAIMS",
			signature: `prior:${targetIndex ?? "unknown"}:${claimableIndex ?? "none"}:${pendingAhead}`,
			details: {
				waiting: "prior-claims",
				targetIndex,
				pendingAhead,
				claimIndex: claimableIndex,
				finalizeAvailable: canFinalize.available,
				finalizeReason: canFinalize.reason
			}
		}
	}
	if (!target || !target.committed) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_SUBMISSION",
			signature: target ? `submission:commit:${target.index}` : "submission:pending",
			details: {
				waiting: "submission",
				targetIndex: target?.index,
				submitHash: getSubmitHash(session)
			}
		}
	}
	return {
		action: "wait",
		analysis,
		event: "MARK_WAITING_FINALIZATION",
		signature: `finalization:${target.index}:${claimableIndex ?? "none"}`,
		details: {
			waiting: "finalization",
			targetIndex: target.index,
			claimIndex: claimableIndex,
			finalizeAvailable: canFinalize.available,
			finalizeReason: canFinalize.reason
		}
	}
}

const transition = (
	session: OperationSession,
	event: TransitionEvent,
	now: () => string,
	patch: Partial<OperationSession> = {}
): OperationSession => {
	const timestamp = now()
	const next = OPERATION_STATE_BY_EVENT[event]
	return {
		...session,
		...patch,
		phase: next.phase,
		status: next.status,
		updatedAt: timestamp,
		verboseDiagnostics: session.verboseDiagnostics
			? updatePhaseTiming(session.verboseDiagnostics, timestamp, next.phase)
			: undefined
	}
}

const updatePhaseTiming = (
	diagnostics: BridgeVerboseDiagnostics,
	now: string,
	nextPhase: OperationPhase
): BridgeVerboseDiagnostics => {
	const phaseTimings = [...diagnostics.phaseTimings]
	const current = phaseTimings.at(-1)
	if (!current)
		return { ...diagnostics, phaseTimings: [{ phase: nextPhase, startedAt: now, durationMs: 0 }] }
	const elapsed = Math.max(0, Date.parse(now) - Date.parse(current.startedAt))
	const closed = {
		...current,
		endedAt: now,
		durationMs: Number.isNaN(elapsed) ? current.durationMs : elapsed
	}
	if (current.phase === nextPhase) {
		phaseTimings[phaseTimings.length - 1] = { ...closed, endedAt: undefined }
		return { ...diagnostics, phaseTimings }
	}
	phaseTimings[phaseTimings.length - 1] = closed
	phaseTimings.push({ phase: nextPhase, startedAt: now, durationMs: 0 })
	return { ...diagnostics, phaseTimings }
}

const createVerboseDiagnostics = (
	startedAt: string,
	phase: OperationPhase
): BridgeVerboseDiagnostics => ({
	sdkCalls: [],
	sdkMethodStats: {},
	phaseTimings: [{ phase, startedAt, durationMs: 0 }],
	waitReasons: {}
})

const recordSdkCall = (session: OperationSession, trace: BridgeSdkCallTrace): OperationSession => {
	if (!session.verboseDiagnostics) return session
	const sdkCalls = [...session.verboseDiagnostics.sdkCalls, trace]
	const stats: BridgeVerboseDiagnostics["sdkMethodStats"] = {}
	for (const call of sdkCalls) {
		const previous = stats[call.operation]
		stats[call.operation] = {
			count: (previous?.count ?? 0) + 1,
			successCount: (previous?.successCount ?? 0) + (call.success ? 1 : 0),
			errorCount: (previous?.errorCount ?? 0) + (call.success ? 0 : 1),
			totalDurationMs: (previous?.totalDurationMs ?? 0) + call.durationMs,
			lastStartedAt: call.startedAt,
			lastEndedAt: call.endedAt,
			lastDurationMs: call.durationMs,
			lastMessage: call.message,
			lastResult: call.result
		}
	}
	return {
		...session,
		verboseDiagnostics: { ...session.verboseDiagnostics, sdkCalls, sdkMethodStats: stats }
	}
}

const recordWaitReason = (
	session: OperationSession,
	key: "canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal",
	diagnostic: BridgeCapabilityDiagnostic
): OperationSession =>
	session.verboseDiagnostics
		? {
				...session,
				verboseDiagnostics: {
					...session.verboseDiagnostics,
					waitReasons: { ...session.verboseDiagnostics.waitReasons, [key]: diagnostic }
				}
			}
		: session

const mergeDiagnostics = (
	session: OperationSession,
	sources: OperationSession[]
): OperationSession => {
	if (!session.verboseDiagnostics) return sources.at(-1) ?? session
	const baseCount = session.verboseDiagnostics.sdkCalls.length
	return sources.reduce((next, source) => {
		if (!source.verboseDiagnostics) return next
		const calls = source.verboseDiagnostics.sdkCalls.slice(baseCount)
		return calls.reduce(recordSdkCall, next)
	}, session)
}

const summarizeSdkResult = (value: unknown): string | undefined => {
	if (typeof value === "boolean") return String(value)
	if (Array.isArray(value)) return `count=${value.length}`
	if (typeof value !== "object" || value === null) return undefined
	if ("available" in value && typeof value.available === "boolean")
		return `available=${String(value.available)}`
	return "hash" in value && typeof value.hash === "string" ? `hash=${value.hash}` : undefined
}

const durationMs = (startedAt: string, endedAt: string) => {
	const start = Date.parse(startedAt)
	const end = Date.parse(endedAt)
	return Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, end - start)
}

const appendTransaction = (
	session: OperationSession,
	transaction: { action: "submit" | "finalize" | "cancel"; hash: string }
) => ({ submittedTransactions: [...session.submittedTransactions, transaction] })

const persist = async (
	session: OperationSession,
	sessionStore: Pick<SessionStore, "save">,
	log: LogFn,
	event: string,
	details?: Record<string, unknown>
) => {
	await sessionStore.save(session)
	await log({ event, phase: session.phase, details })
}

const withRetry = async <T>({
	session,
	sessionStore,
	log,
	sleep,
	retryDelayMs,
	now,
	operation,
	shouldRetry,
	run
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	sleep: (ms: number) => Promise<void>
	retryDelayMs?: number
	now: () => string
	operation: BridgeSdkOperation
	shouldRetry?: (error: unknown) => boolean
	run: () => Promise<T>
}): Promise<{ session: OperationSession; value: T }> => {
	let currentSession = session
	for (let attempt = 1; ; attempt += 1) {
		const startedAt = now()
		try {
			const value = await run()
			const endedAt = now()
			return {
				value,
				session: recordSdkCall(currentSession, {
					operation,
					attempt,
					startedAt,
					endedAt,
					durationMs: durationMs(startedAt, endedAt),
					success: true,
					result: summarizeSdkResult(value)
				})
			}
		} catch (error) {
			const endedAt = now()
			currentSession = recordSdkCall(currentSession, {
				operation,
				attempt,
				startedAt,
				endedAt,
				durationMs: durationMs(startedAt, endedAt),
				success: false,
				message: formatErrorMessage(error)
			})
			if (shouldRetry && !shouldRetry(error)) throw error
			currentSession = transition(currentSession, "MARK_RETRYING", now, {
				lastError: formatErrorMessage(error)
			})
			await persist(currentSession, sessionStore, log, "retrying", {
				operation,
				message: formatErrorMessage(error)
			})
			await sleep(retryDelayMs ?? RETRY_SLEEP_MS)
		}
	}
}

const isRecoverableMutationError = (error: unknown): boolean => {
	const message = formatErrorMessage(error)
	return (
		/Failed to fetch|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Failed to fetch proved forest|No key returned from mutation/i.test(
			message
		) && !isInsufficientFirstWithdrawalAmountError(error)
	)
}

const isTransientClaimUnavailableError = (error: unknown): boolean =>
	[
		/Did not find any (deposit|withdrawal) to finalize/i,
		/No (deposit|withdrawal) witnesses found/i,
		/No earliest before state found/i,
		/No my (deposit|withdrawal) index found/i,
		/No next commit index found/i,
		/No synced outer action state index found/i
	].some((pattern) => pattern.test(formatErrorMessage(error)))

const completeSession = async ({
	session,
	sessionStore,
	log,
	now,
	finalTransaction
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	finalTransaction?: OperationSession["finalTransaction"]
}) => {
	const completed = transition(
		session,
		"MARK_COMPLETED",
		now,
		finalTransaction ? { finalTransaction } : {}
	)
	await persist(completed, sessionStore, log, "completed", {
		hash: completed.finalTransaction?.hash
	})
	return completed
}

const failSession = async ({
	session,
	sessionStore,
	log,
	now,
	error
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	error: string
}) => {
	const failed = transition(session, "MARK_FAILED", now, { lastError: error })
	await persist(failed, sessionStore, log, "failed", { message: error })
	return failed
}

const emitHeartbeat = async ({
	session,
	now,
	pollIntervalMs,
	tracker,
	log,
	details
}: {
	session: OperationSession
	now: () => string
	pollIntervalMs: number
	tracker: {
		lastWaitSignature?: string
		lastHeartbeatBucket?: number
		emittedImmediateHeartbeat: boolean
	}
	log: LogFn
	details: Record<string, unknown>
}) => {
	const elapsedSeconds = Math.max(
		0,
		Math.floor((Date.parse(now()) - Date.parse(session.createdAt)) / 1000)
	)
	if (pollIntervalMs === 0) {
		if (!tracker.emittedImmediateHeartbeat) {
			tracker.emittedImmediateHeartbeat = true
			await log({
				event: "heartbeat",
				phase: session.phase,
				details: { elapsedSeconds, ...details }
			})
		}
		return
	}
	const interval = Math.max(pollIntervalMs, HEARTBEAT_INTERVAL_MS)
	const bucket = Math.floor((elapsedSeconds * 1_000) / interval)
	if (bucket > 0 && bucket !== tracker.lastHeartbeatBucket) {
		tracker.lastHeartbeatBucket = bucket
		await log({ event: "heartbeat", phase: session.phase, details: { elapsedSeconds, ...details } })
	}
}

type BridgeFlowDeps = {
	adapter: Partial<BridgeAdapter>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	sleep: (ms: number) => Promise<void>
	pollIntervalMs: number
	retryDelayMs?: number
	now?: () => string
	verbose?: boolean
}

type BridgeFlowInput = {
	id: string
	from: ChainRef
	to: ChainRef
	amount: string
	account: string
	recipient?: string
	timeoutSlots?: number
	session?: OperationSession
}

const method = <T extends keyof BridgeAdapter>(
	adapter: Partial<BridgeAdapter>,
	name: T
): NonNullable<BridgeAdapter[T]> => {
	const value = adapter[name]
	if (!value) throw new Error(`Adapter does not implement ${String(name)}`)
	return value as NonNullable<BridgeAdapter[T]>
}

const initialSession = (input: BridgeFlowInput, deps: BridgeFlowDeps): OperationSession => {
	const route = resolveRoute(input.from, input.to)
	const now = deps.now ?? (() => new Date().toISOString())
	const createdAt = now()
	const session =
		input.session ??
		({
			id: input.id,
			status: "running",
			phase: "initializing",
			route: formatRoute(input.from, input.to),
			direction: route.direction,
			account: input.account,
			recipient: input.recipient ?? input.account,
			amount: input.amount,
			timeoutSlots: input.timeoutSlots,
			logPath: "",
			createdAt,
			updatedAt: createdAt,
			submittedTransactions: []
		} satisfies OperationSession)
	return deps.verbose && !session.verboseDiagnostics
		? { ...session, verboseDiagnostics: createVerboseDiagnostics(session.createdAt, session.phase) }
		: session
}

export const runBridgeOperation = async (
	input: BridgeFlowInput,
	deps: BridgeFlowDeps
): Promise<OperationSession> => {
	let session = initialSession(input, deps)
	const now = deps.now ?? (() => new Date().toISOString())
	const tracker = { emittedImmediateHeartbeat: false } as {
		lastWaitSignature?: string
		lastHeartbeatBucket?: number
		emittedImmediateHeartbeat: boolean
	}
	await persist(session, deps.sessionStore, deps.log, "initialized")

	const setWait = async (
		decision: Extract<Decision, { action: "wait" }>,
		patch: Partial<OperationSession> = {}
	) => {
		if (tracker.lastWaitSignature === decision.signature) {
			session = { ...session, ...patch, updatedAt: now() }
			return
		}
		session = transition(session, decision.event, now, patch)
		tracker.lastWaitSignature = decision.signature
		tracker.emittedImmediateHeartbeat = false
		await persist(
			session,
			deps.sessionStore,
			deps.log,
			decision.details.waiting === "prior-claims"
				? "waiting-on-prior-claims"
				: decision.details.waiting === "submission"
					? "waiting-for-submission"
					: "waiting-for-finalization",
			decision.details
		)
	}

	while (session.status === "running") {
		try {
			if (session.direction === "withdrawal" && session.submittedTransactions.length === 0) {
				const submit = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "submitWithdrawal",
					shouldRetry: isRecoverableMutationError,
					run: () =>
						method(
							deps.adapter,
							"submitWithdrawal"
						)({
							account: session.account,
							recipient: session.recipient,
							amount: session.amount,
							wait: false
						})
				})
				session = transition(
					submit.session,
					"MARK_SUBMITTED",
					now,
					appendTransaction(submit.session, { action: "submit", hash: submit.value.hash })
				)
				await persist(session, deps.sessionStore, deps.log, "submitted", {
					hash: submit.value.hash
				})
				continue
			}

			if (session.direction === "deposit") {
				const statusesResult = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "getDepositStatuses",
					run: () => method(deps.adapter, "getDepositStatuses")(session.account)
				})
				session = statusesResult.session
				const statuses = sortByIndex(statusesResult.value)
				const hasSubmit = getSubmitHash(session) !== undefined
				let decision = decideDepositStep({
					session,
					statuses,
					canFinalize: { available: false, reason: null },
					canCancel: { available: false, reason: null },
					now
				})
				const initialAnalysis = decision.analysis as DepositQueueState
				if (
					hasSubmit &&
					initialAnalysis.targetIndex !== undefined &&
					session.targetIndex !== initialAnalysis.targetIndex
				) {
					session = { ...session, targetIndex: initialAnalysis.targetIndex, updatedAt: now() }
					await deps.sessionStore.save(session)
				}
				if (decision.action === "submit") {
					const submit = await withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "submitDeposit",
						shouldRetry: isRecoverableMutationError,
						run: () =>
							method(
								deps.adapter,
								"submitDeposit"
							)({
								account: session.account,
								recipient: session.recipient,
								amount: session.amount,
								timeoutSlots: session.timeoutSlots,
								wait: false
							})
					})
					session = transition(
						submit.session,
						"MARK_SUBMITTED",
						now,
						appendTransaction(submit.session, { action: "submit", hash: submit.value.hash })
					)
					await persist(session, deps.sessionStore, deps.log, "submitted", {
						hash: submit.value.hash
					})
					continue
				}
				if (decision.action === "cancelled") {
					session = transition(session, "MARK_CANCELLED", now)
					await persist(session, deps.sessionStore, deps.log, "cancelled")
					break
				}
				if (decision.action === "complete") {
					const target = initialAnalysis.target
					session = await completeSession({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						now,
						finalTransaction:
							session.finalTransaction ??
							(target ? { action: "finalize", hash: target.hash, explorerUrl: "" } : undefined)
					})
					break
				}
				if (decision.action === "wait") {
					await setWait(
						decision,
						decision.event === "MARK_WAITING_FINALIZATION"
							? { targetIndex: hasSubmit ? initialAnalysis.target?.index : undefined }
							: decision.event === "MARK_WAITING_PRIOR_CLAIMS"
								? {
										targetIndex: hasSubmit ? initialAnalysis.targetIndex : undefined,
										queueAdvances: session.queueAdvances ?? 0
									}
								: {}
					)
				}
				const [canFinalizeResult, canCancelResult] = await Promise.all([
					withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "canFinalizeDeposit",
						run: async () =>
							capabilityDiagnostic(
								await (deps.adapter.canFinalizeDeposit?.(session.account) ?? false)
							)
					}),
					withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "canCancelDeposit",
						run: async () =>
							capabilityDiagnostic(
								await (deps.adapter.canCancelDeposit?.(session.account) ?? false)
							)
					})
				])
				session = mergeDiagnostics(session, [canFinalizeResult.session, canCancelResult.session])
				session = recordWaitReason(
					recordWaitReason(session, "canFinalizeDeposit", canFinalizeResult.value),
					"canCancelDeposit",
					canCancelResult.value
				)
				decision = decideDepositStep({
					session,
					statuses,
					canFinalize: canFinalizeResult.value,
					canCancel: canCancelResult.value,
					now
				})
				const analysis = decision.analysis as DepositQueueState
				if (decision.action === "finalize") {
					const effectiveClaimableIndex = resolveEffectiveDepositClaimableIndex({
						claimableIndex: decision.claimableIndex ?? analysis.claimableIndex,
						target: analysis.target,
						pendingAhead: analysis.pendingAhead,
						canFinalize: true
					})
					try {
						const finalized = await withRetry({
							session,
							sessionStore: deps.sessionStore,
							log: deps.log,
							sleep: deps.sleep,
							retryDelayMs: deps.retryDelayMs,
							now,
							operation: "finalizeDeposit",
							shouldRetry: isRecoverableMutationError,
							run: () =>
								method(deps.adapter, "finalizeDeposit")({ account: session.account, wait: false })
						})
						session = transition(finalized.session, "MARK_FINALIZING", now, {
							...appendTransaction(finalized.session, {
								action: "finalize",
								hash: finalized.value.hash
							}),
							finalTransaction:
								hasSubmit && analysis.target && effectiveClaimableIndex === analysis.target.index
									? {
											action: "finalize",
											hash: finalized.value.hash,
											explorerUrl: finalized.value.explorerUrl
										}
									: session.finalTransaction,
							pendingFinalizeIndex: effectiveClaimableIndex,
							pendingFinalizeSubmittedAt: now(),
							queueAdvances: analysis.shouldAdvanceQueuedClaims
								? (session.queueAdvances ?? 0) + 1
								: session.queueAdvances
						})
						tracker.lastWaitSignature = undefined
						tracker.emittedImmediateHeartbeat = false
						await persist(session, deps.sessionStore, deps.log, "finalized", {
							hash: finalized.value.hash,
							claimIndex: effectiveClaimableIndex,
							advancedPriorClaim: analysis.shouldAdvanceQueuedClaims
						})
					} catch (error) {
						if (!isTransientClaimUnavailableError(error)) throw error
						await deps.log({
							event: "claim-pending",
							phase: session.phase,
							details: { claimIndex: effectiveClaimableIndex, message: formatErrorMessage(error) }
						})
					}
					continue
				}
				if (decision.action === "cancel") {
					const canceled = await withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "cancelDeposit",
						shouldRetry: isRecoverableMutationError,
						run: () =>
							method(deps.adapter, "cancelDeposit")({ account: session.account, wait: false })
					})
					const cancellingCurrent =
						hasSubmit && analysis.target !== undefined && analysis.pendingAhead === 0
					session = transition(canceled.session, "MARK_CANCELLING", now, {
						...appendTransaction(canceled.session, { action: "cancel", hash: canceled.value.hash }),
						finalTransaction: cancellingCurrent
							? {
									action: "cancel",
									hash: canceled.value.hash,
									explorerUrl: canceled.value.explorerUrl
								}
							: session.finalTransaction,
						pendingCancelMarker: decision.cancelMarker,
						queueAdvances: analysis.shouldAdvanceQueuedClaims
							? (session.queueAdvances ?? 0) + 1
							: session.queueAdvances
					})
					tracker.lastWaitSignature = undefined
					tracker.emittedImmediateHeartbeat = false
					await persist(session, deps.sessionStore, deps.log, "cancel-submitted", {
						hash: canceled.value.hash,
						advancedPriorClaim: analysis.shouldAdvanceQueuedClaims,
						pendingAhead: analysis.pendingAhead,
						claimIndex: analysis.claimableIndex
					})
					continue
				}
				if (decision.action === "wait") {
					await emitHeartbeat({
						session,
						now,
						pollIntervalMs: deps.pollIntervalMs,
						tracker,
						log: deps.log,
						details: decision.details
					})
					await deps.sleep(deps.pollIntervalMs)
					continue
				}
			}

			if (session.direction === "withdrawal") {
				const statusesResult = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "getWithdrawalStatuses",
					run: () => method(deps.adapter, "getWithdrawalStatuses")(session.account)
				})
				session = statusesResult.session
				const statuses = sortByIndex(statusesResult.value)
				let decision = decideWithdrawalStep({
					session,
					statuses,
					canFinalize: { available: false, reason: null },
					now
				})
				const initialAnalysis = decision.analysis as WithdrawalQueueState
				if (
					initialAnalysis.targetIndex !== undefined &&
					session.targetIndex !== initialAnalysis.targetIndex
				) {
					session = { ...session, targetIndex: initialAnalysis.targetIndex, updatedAt: now() }
					await deps.sessionStore.save(session)
				}
				if (decision.action === "complete") {
					const target = initialAnalysis.target
					session = await completeSession({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						now,
						finalTransaction:
							session.finalTransaction ??
							(target ? { action: "finalize", hash: target.hash, explorerUrl: "" } : undefined)
					})
					break
				}
				if (decision.action === "wait") {
					await setWait(
						decision,
						decision.event === "MARK_WAITING_FINALIZATION" && initialAnalysis.target
							? { targetIndex: initialAnalysis.target.index }
							: decision.event === "MARK_WAITING_PRIOR_CLAIMS"
								? {
										targetIndex: initialAnalysis.targetIndex,
										queueAdvances: session.queueAdvances ?? 0
									}
								: {}
					)
					if (
						decision.event === "MARK_WAITING_SUBMISSION" &&
						initialAnalysis.target &&
						!initialAnalysis.target.committed
					) {
						await emitHeartbeat({
							session,
							now,
							pollIntervalMs: deps.pollIntervalMs,
							tracker,
							log: deps.log,
							details: decision.details
						})
						await deps.sleep(deps.pollIntervalMs)
						continue
					}
				}
				const canFinalize = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "canFinalizeWithdrawal",
					shouldRetry: (error) => !isInsufficientFirstWithdrawalAmountError(error),
					run: async () =>
						capabilityDiagnostic(
							await (deps.adapter.canFinalizeWithdrawal?.(session.account) ?? false)
						)
				})
				session = recordWaitReason(canFinalize.session, "canFinalizeWithdrawal", canFinalize.value)
				decision = decideWithdrawalStep({ session, statuses, canFinalize: canFinalize.value, now })
				const analysis = decision.analysis as WithdrawalQueueState
				if (decision.action === "complete") {
					session = await completeSession({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						now,
						finalTransaction: session.finalTransaction ?? {
							action: "finalize",
							hash: analysis.target?.hash ?? getSubmitHash(session) ?? "",
							explorerUrl: ""
						}
					})
					break
				}
				if (decision.action === "finalize") {
					try {
						const finalized = await withRetry({
							session,
							sessionStore: deps.sessionStore,
							log: deps.log,
							sleep: deps.sleep,
							retryDelayMs: deps.retryDelayMs,
							now,
							operation: "finalizeWithdrawal",
							shouldRetry: isRecoverableMutationError,
							run: () =>
								method(
									deps.adapter,
									"finalizeWithdrawal"
								)({ account: session.account, wait: false })
						})
						session = transition(finalized.session, "MARK_FINALIZING", now, {
							...appendTransaction(finalized.session, {
								action: "finalize",
								hash: finalized.value.hash
							}),
							finalTransaction:
								analysis.target && analysis.claimableIndex === analysis.target.index
									? {
											action: "finalize",
											hash: finalized.value.hash,
											explorerUrl: finalized.value.explorerUrl
										}
									: session.finalTransaction,
							pendingFinalizeIndex: analysis.claimableIndex,
							pendingFinalizeSubmittedAt: now(),
							queueAdvances: analysis.shouldAdvanceQueuedClaims
								? (session.queueAdvances ?? 0) + 1
								: session.queueAdvances
						})
						tracker.lastWaitSignature = undefined
						tracker.emittedImmediateHeartbeat = false
						await persist(session, deps.sessionStore, deps.log, "finalized", {
							hash: finalized.value.hash,
							claimIndex: analysis.claimableIndex,
							advancedPriorClaim: analysis.shouldAdvanceQueuedClaims
						})
					} catch (error) {
						if (!isTransientClaimUnavailableError(error)) throw error
						await deps.log({
							event: "claim-pending",
							phase: session.phase,
							details: { claimIndex: analysis.claimableIndex, message: formatErrorMessage(error) }
						})
					}
					continue
				}
				if (decision.action === "wait") {
					await emitHeartbeat({
						session,
						now,
						pollIntervalMs: deps.pollIntervalMs,
						tracker,
						log: deps.log,
						details: decision.details
					})
					await deps.sleep(deps.pollIntervalMs)
				}
			}
		} catch (error) {
			session = await failSession({
				session,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			})
			break
		}
	}

	return session
}

const renderOperationProgress = ({
	event,
	phase,
	details
}: {
	event: string
	phase: OperationPhase
	details?: Record<string, unknown>
}): string => {
	const suffix = details ? ` ${JSON.stringify(details)}` : ""
	return `[${phase}] ${event}${suffix}`
}

export const toBridgeJsonResult = (session: OperationSession) => ({
	success: session.status === "completed" || session.status === "cancelled",
	id: session.id,
	status: session.status,
	phase: session.phase,
	route: session.route,
	direction: session.direction,
	account: session.account,
	recipient: session.recipient ?? session.account,
	amount: session.amount,
	timeout_slots: session.timeoutSlots,
	target_index: session.targetIndex,
	log_path: session.logPath,
	submitted_transactions: session.submittedTransactions,
	final_transaction: session.finalTransaction,
	error: session.lastError ?? null,
	created_at: session.createdAt,
	updated_at: session.updatedAt,
	verbose_diagnostics: session.verboseDiagnostics
})

export const renderBridgeResult = (session: OperationSession): string =>
	[
		`${session.status === "completed" || session.status === "cancelled" ? "Success" : "Failed"}: ${session.direction} ${session.amount} ${session.route}`,
		`Operation: ${session.id}`,
		`Status: ${session.status}`,
		`Phase: ${session.phase}`,
		`Account: ${session.account}`,
		`Recipient: ${session.recipient ?? session.account}`,
		`Submit: ${getSubmitHash(session) ?? "-"}`,
		`Final: ${session.finalTransaction?.hash ?? "-"}`,
		`Log: ${session.logPath}`,
		...(session.lastError ? [`Error: ${session.lastError}`] : [])
	].join("\n")

const createProgressLog =
	({
		writeProgress,
		logger
	}: {
		writeProgress: (message: string) => void
		logger?: Pick<ReturnType<typeof createOperationLogger>, "write">
	}): LogFn =>
	async ({ event, phase, details }) => {
		writeProgress(renderOperationProgress({ event, phase, details }))
		await logger?.write(event, { phase, ...details })
	}

const createAdapterWithRetries = async ({
	createAdapter,
	from,
	to,
	verbose,
	log,
	sleep,
	retryDelayMs
}: {
	createAdapter: BridgeAdapterFactory
	from: ChainRef
	to: ChainRef
	verbose: boolean
	log: LogFn
	sleep: (ms: number) => Promise<void>
	retryDelayMs: number
}): Promise<BridgeAdapter> => {
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await createAdapter({ from, to, verbose })
		} catch (error) {
			const message = formatErrorMessage(error)
			if (
				/Missing required signer private key|Unsupported bridge route|Invalid private key/i.test(
					message
				)
			) {
				throw error
			}
			await log({
				event: "retrying",
				phase: "initializing",
				details: { operation: "Bridge.init", attempt, message }
			})
			await sleep(retryDelayMs)
		}
	}
}

type BridgeCommandDeps = {
	createAdapter?: BridgeAdapterFactory
	createStore?: (input: { stateDir: string }) => Pick<SessionStore, "save">
	createLogger?: (input: { logPath: string }) => Pick<
		ReturnType<typeof createOperationLogger>,
		"write"
	>
	now?: () => string
	resolvePaths?: typeof resolveAppPaths
	generateId?: () => string
	write?: (message: string) => void
	writeProgress?: (message: string) => void
	sleep?: (ms: number) => Promise<void>
	pollIntervalMs?: number
	retryDelayMs?: number
}

const commonBridgeArgs: NonNullable<CommandDef["args"]> = {
	from: { type: "string", default: "mina:testnet" },
	to: { type: "string", default: "zeko:testnet" },
	amount: { type: "string", required: true },
	account: { type: "string", required: false },
	recipient: { type: "string", required: false },
	timeoutSlots: { type: "string", required: false, alias: ["timeout-slots"] },
	pollIntervalMs: { type: "string", required: false, alias: ["poll-interval-ms"] },
	retryDelayMs: { type: "string", required: false, alias: ["retry-delay-ms"] },
	json: { type: "boolean", default: false },
	verbose: { type: "boolean", default: false }
}

export const createBridgeCommand = (deps: BridgeCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: { name: "bridge", description: "Run a full bridge flow from source to destination." },
		args: commonBridgeArgs,
		async run({ args }) {
			const from = parseChainRef(readString(args, "from") ?? "mina:testnet", "--from")
			const to = parseChainRef(readString(args, "to") ?? "zeko:testnet", "--to")
			const route = resolveRoute(from, to)
			const json = readBoolean(args, "json")
			const verbose = readBoolean(args, "verbose")
			const now = deps.now ?? (() => new Date().toISOString())
			const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
			const id = (deps.generateId ?? randomUUID)()
			const logPath = path.join(appPaths.logDir, `${id}.jsonl`)
			const logger = (deps.createLogger ?? createOperationLogger)({ logPath })
			const log = createProgressLog({ writeProgress: deps.writeProgress ?? console.error, logger })
			const sleep = deps.sleep ?? sleepFor
			const pollIntervalMs =
				readAliasedNumber(args, "pollIntervalMs", "poll-interval-ms", "--poll-interval-ms") ??
				deps.pollIntervalMs ??
				20_000
			const retryDelayMs =
				readAliasedNumber(args, "retryDelayMs", "retry-delay-ms", "--retry-delay-ms") ??
				deps.retryDelayMs
			const account = deriveAccount(from, readString(args, "account"))
			const recipient = readString(args, "recipient") ?? deriveAccount(to)
			const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
			const adapter = await createAdapterWithRetries({
				createAdapter: deps.createAdapter ?? createDefaultBridgeAdapter,
				from,
				to,
				verbose,
				log,
				sleep,
				retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
			})
			const session = await runBridgeOperation(
				{
					id,
					from,
					to,
					amount: readRequired(args, "amount", "Missing required --amount"),
					account,
					recipient,
					timeoutSlots: resolveDepositTimeoutSlots(
						readAliasedString(args, "timeoutSlots", "timeout-slots")
							? Number(readAliasedString(args, "timeoutSlots", "timeout-slots"))
							: undefined
					)
				},
				{
					adapter,
					sessionStore: store,
					log,
					sleep,
					pollIntervalMs,
					retryDelayMs,
					now,
					verbose
				}
			)
			const output = json
				? JSON.stringify(toBridgeJsonResult(session), null, 2)
				: renderBridgeResult(session)
			;(deps.write ?? console.log)(output)
			if (session.status === "failed") process.exitCode = 1
			void route
		}
	})

type DirectRouteArgs = {
	from: ChainRef
	to: ChainRef
	json: boolean
	verbose?: boolean
}

const readRouteArgs = (args: Record<string, unknown>): DirectRouteArgs => ({
	from: parseChainRef(readString(args, "from") ?? "mina:testnet", "--from"),
	to: parseChainRef(readString(args, "to") ?? "zeko:testnet", "--to"),
	json: readBoolean(args, "json"),
	verbose: readBoolean(args, "verbose")
})

const retryRecoverableMutation = async <T>({
	run,
	sleep = sleepFor,
	retryDelayMs = DIRECT_MUTATION_RETRY_DELAY_MS
}: {
	run: () => Promise<T>
	sleep?: (ms: number) => Promise<void>
	retryDelayMs?: number
}): Promise<T> => {
	for (;;) {
		try {
			return await run()
		} catch (error) {
			if (!isRecoverableMutationError(error)) throw error
			await sleep(retryDelayMs)
		}
	}
}

export const runDepositSubmit = (
	input: DirectRouteArgs & {
		account?: string
		amount: string
		timeoutSlots?: number
		wait: boolean
	},
	deps: {
		adapter: Pick<BridgeAdapter, "submitDeposit">
		sleep?: (ms: number) => Promise<void>
		retryDelayMs?: number
	}
): Promise<TransactionResult> =>
	retryRecoverableMutation({
		run: () =>
			deps.adapter.submitDeposit({
				account: input.account,
				amount: input.amount,
				timeoutSlots: resolveDepositTimeoutSlots(input.timeoutSlots),
				wait: input.wait
			}),
		sleep: deps.sleep,
		retryDelayMs: deps.retryDelayMs
	})

export const runDepositFinalize = (
	input: DirectRouteArgs & { account?: string; wait: boolean },
	deps: { adapter: Pick<BridgeAdapter, "finalizeDeposit"> }
): Promise<TransactionResult> =>
	deps.adapter.finalizeDeposit({ account: input.account, wait: input.wait })

export const runDepositCancel = (
	input: DirectRouteArgs & { account?: string; wait: boolean },
	deps: { adapter: Pick<BridgeAdapter, "cancelDeposit"> }
): Promise<TransactionResult> =>
	deps.adapter.cancelDeposit({ account: input.account, wait: input.wait })

export const runWithdrawalSubmit = (
	input: DirectRouteArgs & { account?: string; amount: string; wait: boolean },
	deps: { adapter: Pick<BridgeAdapter, "submitWithdrawal"> }
): Promise<TransactionResult> =>
	deps.adapter.submitWithdrawal({ account: input.account, amount: input.amount, wait: input.wait })

export const runWithdrawalFinalize = (
	input: DirectRouteArgs & { account?: string; wait: boolean },
	deps: { adapter: Pick<BridgeAdapter, "finalizeWithdrawal"> }
): Promise<TransactionResult> =>
	deps.adapter.finalizeWithdrawal({ account: input.account, wait: input.wait })

export const runDepositStatus = async (
	input: { from: ChainRef; to: ChainRef; account: string; latest: boolean },
	deps: { adapter: Pick<BridgeAdapter, "getDepositStatuses"> }
): Promise<StatusResult<DepositStatus>> => {
	const operations = input.latest
		? sortByIndex(await deps.adapter.getDepositStatuses(input.account)).slice(-1)
		: await deps.adapter.getDepositStatuses(input.account)
	return {
		success: true,
		direction: "deposit",
		route: formatRoute(input.from, input.to),
		account: input.account,
		count: operations.length,
		operations
	}
}

export const runWithdrawalStatus = async (
	input: { from: ChainRef; to: ChainRef; account: string; latest: boolean },
	deps: { adapter: Pick<BridgeAdapter, "getWithdrawalStatuses"> }
): Promise<StatusResult<WithdrawalStatus>> => {
	const operations = input.latest
		? sortByIndex(await deps.adapter.getWithdrawalStatuses(input.account)).slice(-1)
		: await deps.adapter.getWithdrawalStatuses(input.account)
	return {
		success: true,
		direction: "withdrawal",
		route: formatRoute(input.from, input.to),
		account: input.account,
		count: operations.length,
		operations
	}
}

type DirectCommandDeps = {
	createAdapter?: BridgeAdapterFactory
	sleep?: (ms: number) => Promise<void>
	retryDelayMs?: number
	write?: (message: string) => void
}

const createDirectAdapter = (
	createAdapter: BridgeAdapterFactory | undefined,
	route: DirectRouteArgs
) => (createAdapter ?? createDefaultBridgeAdapter)({ ...route, verbose: route.verbose ?? false })

const printDirectResult = (
	result: TransactionResult | StatusResult<DepositStatus | WithdrawalStatus>,
	json: boolean
) => {
	if (json) return JSON.stringify(result, null, 2)
	if ("hash" in result) {
		return [
			`${result.direction} ${result.action} sent`,
			`Hash: ${result.hash}`,
			`Explorer: ${result.explorerUrl}`,
			`Included: ${String(result.included)}`
		].join("\n")
	}
	return [
		`${result.direction} status`,
		`Route: ${result.route}`,
		`Account: ${result.account}`,
		`Count: ${result.count}`,
		...result.operations.map(
			(operation) =>
				`- index=${operation.index} amount=${operation.amount} recipient=${operation.recipient} hash=${operation.hash}`
		)
	].join("\n")
}

export const createDepositCommand = (deps: DirectCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: { name: "deposit", description: "Run direct deposit bridge actions." },
		subCommands: {
			submit: defineCommand({
				meta: { name: "submit", description: "Submit a deposit." },
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					amount: { type: "string", required: true },
					timeoutSlots: { type: "string", required: false, alias: ["timeout-slots"] },
					wait: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runDepositSubmit(
						{
							...route,
							account: readString(args, "account"),
							amount: readRequired(args, "amount", "Missing required --amount"),
							timeoutSlots: readAliasedString(args, "timeoutSlots", "timeout-slots")
								? Number(readAliasedString(args, "timeoutSlots", "timeout-slots"))
								: undefined,
							wait: readBoolean(args, "wait", true)
						},
						{ adapter, sleep: deps.sleep, retryDelayMs: deps.retryDelayMs }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			}),
			finalize: defineCommand({
				meta: { name: "finalize", description: "Finalize a deposit." },
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					wait: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runDepositFinalize(
						{
							...route,
							account: readString(args, "account"),
							wait: readBoolean(args, "wait", true)
						},
						{ adapter }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			}),
			cancel: defineCommand({
				meta: { name: "cancel", description: "Cancel a deposit." },
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					wait: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runDepositCancel(
						{
							...route,
							account: readString(args, "account"),
							wait: readBoolean(args, "wait", true)
						},
						{ adapter }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			}),
			status: defineCommand({
				meta: { name: "status", description: "Show deposit status." },
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					latest: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const account = deriveAccount(route.from, readString(args, "account"))
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runDepositStatus(
						{ ...route, account, latest: readBoolean(args, "latest", true) },
						{ adapter }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			})
		}
	})

export const createWithdrawalCommand = (deps: DirectCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: { name: "withdrawal", description: "Run direct withdrawal bridge actions." },
		subCommands: {
			submit: defineCommand({
				meta: { name: "submit", description: "Submit a withdrawal." },
				args: {
					from: { type: "string", default: "zeko:testnet" },
					to: { type: "string", default: "mina:testnet" },
					account: { type: "string", required: false },
					amount: { type: "string", required: true },
					wait: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runWithdrawalSubmit(
						{
							...route,
							account: readString(args, "account"),
							amount: readRequired(args, "amount", "Missing required --amount"),
							wait: readBoolean(args, "wait", true)
						},
						{ adapter }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			}),
			finalize: defineCommand({
				meta: { name: "finalize", description: "Finalize a withdrawal." },
				args: {
					from: { type: "string", default: "zeko:testnet" },
					to: { type: "string", default: "mina:testnet" },
					account: { type: "string", required: false },
					wait: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runWithdrawalFinalize(
						{
							...route,
							account: readString(args, "account"),
							wait: readBoolean(args, "wait", true)
						},
						{ adapter }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			}),
			status: defineCommand({
				meta: { name: "status", description: "Show withdrawal status." },
				args: {
					from: { type: "string", default: "zeko:testnet" },
					to: { type: "string", default: "mina:testnet" },
					account: { type: "string", required: false },
					latest: { type: "boolean", default: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const route = readRouteArgs(args)
					const account = deriveAccount(route.from, readString(args, "account"))
					const adapter = await createDirectAdapter(deps.createAdapter, route)
					const result = await runWithdrawalStatus(
						{ ...route, account, latest: readBoolean(args, "latest", true) },
						{ adapter }
					)
					;(deps.write ?? console.log)(printDirectResult(result, route.json))
				}
			})
		}
	})

const parseSessionRoute = (session: OperationSession): [ChainRef, ChainRef] =>
	parseRouteString(session.route)

export const projectOperationStatus = (session: OperationSession) => {
	const snapshot = session.liveSnapshot
	const displayPhase =
		session.status === "completed" || session.status === "cancelled" || session.status === "failed"
			? session.phase
			: snapshot?.nextAction === "finalize"
				? "ready-finalization"
				: snapshot?.nextAction === "cancel"
					? "ready-cancel"
					: session.phase
	return {
		id: session.id,
		status: session.status,
		phase: displayPhase,
		route: session.route,
		direction: session.direction,
		account: session.account,
		recipient: session.recipient ?? session.account,
		amount: session.amount,
		log_path: session.logPath,
		refreshed_at: snapshot?.refreshedAt ?? session.updatedAt,
		target_index: snapshot?.targetIndex ?? session.targetIndex ?? null,
		claimable_index: snapshot?.claimableIndex ?? null,
		pending_ahead: snapshot?.pendingAhead ?? null,
		can_finalize: snapshot?.canFinalize ?? null,
		can_cancel: snapshot?.canCancel ?? null,
		submit_hash: snapshot?.submitHash ?? getSubmitHash(session) ?? null,
		next_action: snapshot?.nextAction ?? null,
		waiting_on: snapshot?.waitingOn ?? null,
		error: session.lastError ?? null,
		verbose_diagnostics: session.verboseDiagnostics
	}
}

const refreshSessionFromNetwork = async ({
	session,
	adapter,
	now
}: {
	session: OperationSession
	adapter: BridgeAdapter
	now: () => string
}): Promise<OperationSession> => {
	const submitHash = getSubmitHash(session)
	if (session.direction === "deposit") {
		const statuses = sortByIndex(await adapter.getDepositStatuses(session.account))
		const canFinalize = capabilityDiagnostic(
			await (adapter.canFinalizeDeposit?.(session.account) ?? false)
		)
		const canCancel = capabilityDiagnostic(
			await (adapter.canCancelDeposit?.(session.account) ?? false)
		)
		const decision = decideDepositStep({ session, statuses, canFinalize, canCancel, now })
		const analysis = decision.analysis as DepositQueueState
		return {
			...session,
			updatedAt: now(),
			liveSnapshot: {
				refreshedAt: now(),
				nextAction:
					decision.action === "complete"
						? "completed"
						: decision.action === "cancelled"
							? "cancelled"
							: decision.action === "finalize"
								? "finalize"
								: decision.action === "cancel"
									? "cancel"
									: "wait",
				waitingOn:
					decision.action === "wait"
						? (decision.details.waiting as OperationLiveSnapshot["waitingOn"])
						: undefined,
				targetIndex: analysis.targetIndex,
				claimableIndex: analysis.claimableIndex,
				pendingAhead: analysis.pendingAhead,
				canFinalize: canFinalize.available,
				canCancel: canCancel.available,
				submitHash,
				observedCounts: { deposits: statuses.length, withdrawals: 0 }
			}
		}
	}
	const statuses = sortByIndex(await adapter.getWithdrawalStatuses(session.account))
	const canFinalize = capabilityDiagnostic(
		await (adapter.canFinalizeWithdrawal?.(session.account) ?? false)
	)
	const decision = decideWithdrawalStep({ session, statuses, canFinalize, now })
	const analysis = decision.analysis as WithdrawalQueueState
	return {
		...session,
		updatedAt: now(),
		liveSnapshot: {
			refreshedAt: now(),
			nextAction:
				decision.action === "complete"
					? "completed"
					: decision.action === "finalize"
						? "finalize"
						: "wait",
			waitingOn:
				decision.action === "wait"
					? (decision.details.waiting as OperationLiveSnapshot["waitingOn"])
					: undefined,
			targetIndex: analysis.targetIndex,
			claimableIndex: analysis.claimableIndex,
			pendingAhead: analysis.pendingAhead,
			canFinalize: canFinalize.available,
			submitHash,
			observedCounts: { deposits: 0, withdrawals: statuses.length }
		}
	}
}

type ResumeQueueItem = {
	direction: Direction
	from: ChainRef
	to: ChainRef
	status: DepositStatus | WithdrawalStatus
	session?: OperationSession
}

export const createResumeQueue = ({
	from,
	to,
	account,
	persistedSessions,
	depositStatuses,
	withdrawalStatuses
}: {
	from: ChainRef
	to: ChainRef
	account: string
	persistedSessions: OperationSession[]
	depositStatuses: DepositStatus[]
	withdrawalStatuses: WithdrawalStatus[]
}): ResumeQueueItem[] => {
	const depositRoute = { from: "mina:testnet" as ChainRef, to: "zeko:testnet" as ChainRef }
	const withdrawalRoute = { from: "zeko:testnet" as ChainRef, to: "mina:testnet" as ChainRef }
	const byHash = new Map(
		persistedSessions
			.filter((session) => session.account === account && session.status === "running")
			.map((session) => [getSubmitHash(session), session])
			.filter((entry): entry is [string, OperationSession] => entry[0] !== undefined)
	)
	const deposits = sortByIndex(depositStatuses)
		.filter((status) => !status.finalised && !status.cancelled)
		.map(
			(status): ResumeQueueItem => ({
				direction: "deposit",
				from: depositRoute.from,
				to: depositRoute.to,
				status,
				session: byHash.get(status.hash)
			})
		)
	const withdrawals = sortByIndex(withdrawalStatuses)
		.filter((status) => !status.finalised)
		.map(
			(status): ResumeQueueItem => ({
				direction: "withdrawal",
				from: withdrawalRoute.from,
				to: withdrawalRoute.to,
				status,
				session: byHash.get(status.hash)
			})
		)
	return resolveRoute(from, to).direction === "withdrawal"
		? [...withdrawals, ...deposits]
		: [...deposits, ...withdrawals]
}

const normalizeSessionForResume = ({
	session,
	now
}: {
	session: OperationSession
	now: () => string
}): OperationSession =>
	session.status === "running"
		? { ...session, updatedAt: now(), lastError: undefined }
		: {
				...session,
				status: "running",
				phase: "submitted",
				updatedAt: now(),
				lastError: undefined
			}

const createResumedSession = ({
	item,
	account,
	now,
	logDir,
	generateId
}: {
	item: ResumeQueueItem
	account: string
	now: () => string
	logDir: string
	generateId: () => string
}): OperationSession => {
	if (item.session) return normalizeSessionForResume({ session: item.session, now })
	const id = generateId()
	const status = item.status
	return {
		id,
		status: "running",
		phase: "submitted",
		route: formatRoute(item.from, item.to),
		direction: item.direction,
		account,
		recipient: status.recipient,
		amount: status.amount,
		logPath: path.join(logDir, `${id}.jsonl`),
		createdAt: now(),
		updatedAt: now(),
		targetIndex: status.index,
		submittedTransactions: [{ action: "submit", hash: status.hash }]
	}
}

const renderResumeAllResult = (result: {
	success: boolean
	account: string
	operationsFound: number
	operationsResolved: number
	results: OperationSession[]
}) =>
	[
		`${result.success ? "Success" : "Failed"}: resumed ${result.operationsResolved}/${result.operationsFound} pending operation${result.operationsFound === 1 ? "" : "s"}`,
		`Account: ${result.account}`,
		...result.results.map(
			(session) =>
				`- ${session.id} | ${session.direction} | ${session.route} | ${session.status} | submit=${getSubmitHash(session) ?? "-"} | final=${session.finalTransaction?.hash ?? "-"} | log=${session.logPath}`
		)
	].join("\n")

const completedJson = (sessions: OperationSession[]) => ({
	count: sessions.length,
	operations: sessions.map(toBridgeJsonResult)
})

export const createOperationCommand = (
	deps: {
		createStore?: (input: { stateDir: string }) => Pick<SessionStore, "list" | "load" | "save">
		resolvePaths?: typeof resolveAppPaths
		createAdapter?: BridgeAdapterFactory
		readLog?: (path: string) => Promise<string>
		createLogger?: (input: { logPath: string }) => Pick<
			ReturnType<typeof createOperationLogger>,
			"write"
		>
		write?: (message: string) => void
		writeProgress?: (message: string) => void
		sleep?: (ms: number) => Promise<void>
		pollIntervalMs?: number
		retryDelayMs?: number
		generateId?: () => string
		now?: () => string
	} = {}
): CommandDef =>
	defineCommand({
		meta: { name: "operation", description: "Inspect or resume persisted bridge operations." },
		subCommands: {
			list: defineCommand({
				meta: { name: "list", description: "List persisted operations." },
				async run() {
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					;(deps.write ?? console.log)(JSON.stringify(await store.list(), null, 2))
				}
			}),
			completed: defineCommand({
				meta: { name: "completed", description: "List completed and cancelled operations." },
				args: { json: { type: "boolean", default: false } },
				async run({ args }) {
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const sessions = (await store.list()).filter(
						(session) => session.status === "completed" || session.status === "cancelled"
					)
					;(deps.write ?? console.log)(
						readBoolean(args, "json")
							? JSON.stringify(completedJson(sessions), null, 2)
							: `Completed operations: ${sessions.length}${sessions.length ? `\n${sessions.map((session) => `- ${session.id} | ${session.status} | ${session.direction} | ${session.route} | submit=${getSubmitHash(session) ?? "-"} | final=${session.finalTransaction?.hash ?? "-"} | updated=${session.updatedAt}`).join("\n")}` : "\nNo completed or cancelled operations found."}`
					)
				}
			}),
			status: defineCommand({
				meta: { name: "status", description: "Show one persisted operation." },
				args: {
					id: { type: "positional", required: true },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const id = readRequired(args, "id", "Missing required operation id")
					const now = deps.now ?? (() => new Date().toISOString())
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					const [from, to] = parseSessionRoute(session)
					;(deps.writeProgress ?? console.error)(
						renderOperationProgress({
							event: "refreshing-status",
							phase: session.phase,
							details: { operationId: session.id, route: session.route }
						})
					)
					const refreshed = await refreshSessionFromNetwork({
						session,
						adapter: await (deps.createAdapter ?? createDefaultBridgeAdapter)({
							from,
							to,
							verbose: readBoolean(args, "verbose")
						}),
						now
					})
					await store.save(refreshed)
					;(deps.write ?? console.log)(JSON.stringify(projectOperationStatus(refreshed), null, 2))
				}
			}),
			logs: defineCommand({
				meta: { name: "logs", description: "Print the log file for an operation." },
				args: { id: { type: "positional", required: true } },
				async run({ args }) {
					const id = readRequired(args, "id", "Missing required operation id")
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					;(deps.write ?? console.log)(
						await (deps.readLog ?? ((filePath) => readFile(filePath, "utf8")))(session.logPath)
					)
				}
			}),
			resume: defineCommand({
				meta: { name: "resume", description: "Resume a persisted operation." },
				args: {
					id: { type: "positional", required: true },
					pollIntervalMs: { type: "string", required: false, alias: ["poll-interval-ms"] },
					retryDelayMs: { type: "string", required: false, alias: ["retry-delay-ms"] },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const id = readRequired(args, "id", "Missing required operation id")
					const now = deps.now ?? (() => new Date().toISOString())
					const sleep = deps.sleep ?? sleepFor
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const loaded = await store.load(id)
					if (!loaded) throw new Error(`Operation ${id} not found`)
					const session = normalizeSessionForResume({ session: loaded, now })
					const [from, to] = parseSessionRoute(session)
					const logger = (deps.createLogger ?? createOperationLogger)({ logPath: session.logPath })
					const log = createProgressLog({
						writeProgress: deps.writeProgress ?? console.error,
						logger
					})
					const retryDelayMs =
						readAliasedNumber(args, "retryDelayMs", "retry-delay-ms", "--retry-delay-ms") ??
						deps.retryDelayMs
					const result = await runBridgeOperation(
						{
							id: session.id,
							from,
							to,
							amount: session.amount,
							account: session.account,
							recipient: session.recipient,
							timeoutSlots: session.timeoutSlots,
							session
						},
						{
							adapter: await createAdapterWithRetries({
								createAdapter: deps.createAdapter ?? createDefaultBridgeAdapter,
								from,
								to,
								verbose: readBoolean(args, "verbose"),
								log,
								sleep,
								retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
							}),
							sessionStore: store,
							log,
							sleep,
							pollIntervalMs:
								readAliasedNumber(
									args,
									"pollIntervalMs",
									"poll-interval-ms",
									"--poll-interval-ms"
								) ??
								deps.pollIntervalMs ??
								20_000,
							retryDelayMs,
							now,
							verbose: readBoolean(args, "verbose")
						}
					)
					;(deps.write ?? console.log)(
						readBoolean(args, "json")
							? JSON.stringify(toBridgeJsonResult(result), null, 2)
							: renderBridgeResult(result)
					)
				}
			}),
			"resume-all": defineCommand({
				meta: {
					name: "resume-all",
					description: "Discover and sequentially resume pending bridge operations for an account."
				},
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					pollIntervalMs: { type: "string", required: false, alias: ["poll-interval-ms"] },
					retryDelayMs: { type: "string", required: false, alias: ["retry-delay-ms"] },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const from = parseChainRef(readString(args, "from") ?? "mina:testnet", "--from")
					const to = parseChainRef(readString(args, "to") ?? "zeko:testnet", "--to")
					const account = deriveAccount(from, readString(args, "account"))
					const now = deps.now ?? (() => new Date().toISOString())
					const sleep = deps.sleep ?? sleepFor
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const log = createProgressLog({ writeProgress: deps.writeProgress ?? console.error })
					const retryDelayMs =
						readAliasedNumber(args, "retryDelayMs", "retry-delay-ms", "--retry-delay-ms") ??
						deps.retryDelayMs
					const createAdapter = deps.createAdapter ?? createDefaultBridgeAdapter
					const depositAdapter = await createAdapterWithRetries({
						createAdapter,
						from: "mina:testnet",
						to: "zeko:testnet",
						verbose: readBoolean(args, "verbose"),
						log,
						sleep,
						retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
					})
					const withdrawalAdapter = await createAdapterWithRetries({
						createAdapter,
						from: "zeko:testnet",
						to: "mina:testnet",
						verbose: readBoolean(args, "verbose"),
						log,
						sleep,
						retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
					})
					const queue = createResumeQueue({
						from,
						to,
						account,
						persistedSessions: await store.list(),
						depositStatuses: await depositAdapter.getDepositStatuses(account),
						withdrawalStatuses: await withdrawalAdapter.getWithdrawalStatuses(account)
					})
					const results: OperationSession[] = []
					for (const item of queue) {
						const session = createResumedSession({
							item,
							account,
							now,
							logDir: appPaths.logDir,
							generateId: deps.generateId ?? randomUUID
						})
						const logger = (deps.createLogger ?? createOperationLogger)({
							logPath: session.logPath
						})
						const itemLog = createProgressLog({
							writeProgress: deps.writeProgress ?? console.error,
							logger
						})
						const result = await runBridgeOperation(
							{
								id: session.id,
								from: item.from,
								to: item.to,
								amount: session.amount,
								account,
								recipient: session.recipient,
								timeoutSlots: session.timeoutSlots,
								session
							},
							{
								adapter: await createAdapterWithRetries({
									createAdapter,
									from: item.from,
									to: item.to,
									verbose: readBoolean(args, "verbose"),
									log: itemLog,
									sleep,
									retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
								}),
								sessionStore: store,
								log: itemLog,
								sleep,
								pollIntervalMs:
									readAliasedNumber(
										args,
										"pollIntervalMs",
										"poll-interval-ms",
										"--poll-interval-ms"
									) ??
									deps.pollIntervalMs ??
									20_000,
								retryDelayMs,
								now,
								verbose: readBoolean(args, "verbose")
							}
						)
						results.push(result)
						if (result.status === "failed") break
					}
					const operationsResolved = results.filter(
						(session) => session.status === "completed" || session.status === "cancelled"
					).length
					const result = {
						success:
							results.length === queue.length &&
							results.every(
								(session) => session.status === "completed" || session.status === "cancelled"
							),
						account,
						operationsFound: queue.length,
						operationsResolved,
						results
					}
					;(deps.write ?? console.log)(
						readBoolean(args, "json")
							? JSON.stringify(
									{
										success: result.success,
										account,
										operations_found: queue.length,
										operations_resolved: operationsResolved,
										operations: results.map((session) => ({
											...toBridgeJsonResult(session),
											resolved: session.status === "completed" || session.status === "cancelled"
										}))
									},
									null,
									2
								)
							: renderResumeAllResult(result)
					)
				}
			})
		}
	})

export const createDoctorCommand = (
	deps: {
		resolvePaths?: typeof resolveAppPaths
		resolveKeys?: typeof resolveSignerKeys
		write?: (message: string) => void
	} = {}
): CommandDef =>
	defineCommand({
		meta: { name: "doctor", description: "Check CLI prerequisites and environment configuration." },
		async run() {
			const paths = (deps.resolvePaths ?? resolveAppPaths)()
			const keyConfig = (() => {
				try {
					return { ok: true as const, value: (deps.resolveKeys ?? resolveSignerKeys)() }
				} catch (error) {
					return { ok: false as const, message: formatErrorMessage(error) }
				}
			})()
			;(deps.write ?? console.log)(
				[
					"bridge doctor",
					`Data dir: ${paths.dataDir}`,
					`State dir: ${paths.stateDir}`,
					`Log dir: ${paths.logDir}`,
					`Wallet private key: ${keyConfig.ok ? "configured" : keyConfig.message}`,
					`Known routes: ${KNOWN_ROUTES.map((route) => `${route.from}->${route.to}`).join(", ")}`
				].join("\n")
			)
		}
	})

export const renderTuiSnapshot = ({
	sessions,
	focus,
	logContent
}: {
	sessions: OperationSession[]
	focus: OperationSession | null
	logContent: string
}): string => {
	const active = sessions.filter((session) => session.status === "running")
	const completed = sessions.filter((session) => session.status !== "running")
	const line = (session: OperationSession) =>
		[
			session.id === focus?.id ? ">" : " ",
			session.id,
			session.status,
			session.route,
			`amount=${session.amount}`,
			`updated=${session.updatedAt}`
		].join(" ")
	const lines = ["zeko-bridge tui", "", "Controls: q quit, Ctrl-C quit", "", "Active operations:"]
	lines.push(...(active.length ? active.map(line) : ["No active operations found."]))
	lines.push("", "Completed operations:")
	lines.push(...(completed.length ? completed.map(line) : ["No completed operations found."]))
	if (!focus) return lines.join("\n")
	lines.push(
		"",
		"Selected operation:",
		`ID: ${focus.id}`,
		`Status: ${focus.status}`,
		`Phase: ${focus.phase}`,
		`Route: ${focus.route}`,
		`Recipient: ${focus.recipient ?? focus.account}`,
		`Amount: ${focus.amount}`,
		`Log: ${focus.logPath}`,
		"",
		"Recent log lines:"
	)
	const tail = logContent.trim().split(/\r?\n/).filter(Boolean).slice(-12)
	lines.push(...(tail.length ? tail : ["No log entries yet."]))
	return lines.join("\n")
}

export const createTuiCommand = ({
	loadRenderer,
	spawnBundledTui
}: {
	loadRenderer?: () => Promise<typeof import("@opentui/core")>
	spawnBundledTui?: (id?: string) => Promise<void>
} = {}): CommandDef => {
	const command = defineCommand({
		meta: { name: "tui", description: "Open the bridge operation terminal UI." },
		args: { id: { type: "positional", required: false } },
		async run({ args }) {
			const targetId = readString(args, "id")
			if (!("bun" in process.versions)) {
				if (spawnBundledTui) return spawnBundledTui(targetId)
				const require = createRequire(import.meta.url)
				const packageJsonPath = require.resolve("bun/package.json")
				const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { bin: { bun: string } }
				const cliPath = process.argv[1]
				if (!cliPath)
					throw new Error("Unable to determine the current CLI entrypoint for TUI respawn.")
				await new Promise<void>((resolve, reject) => {
					const child = spawn(
						path.join(path.dirname(packageJsonPath), pkg.bin.bun),
						[cliPath, "tui", ...(targetId ? [targetId] : [])],
						{ stdio: "inherit", env: process.env }
					)
					child.once("error", reject)
					child.once("exit", (code) =>
						code === 0
							? resolve()
							: reject(new Error(`Bundled Bun TUI exited with code ${code ?? "unknown"}`))
					)
				})
				return
			}
			const store = createSessionStore({ stateDir: resolveAppPaths().stateDir })
			const { BoxRenderable, TextRenderable, createCliRenderer } = await (
				loadRenderer ?? (() => import("@opentui/core"))
			)()
			let doneResolve: (() => void) | undefined
			const done = new Promise<void>((resolve) => {
				doneResolve = resolve
			})
			const renderer = await createCliRenderer({
				exitOnCtrlC: true,
				useAlternateScreen: true,
				onDestroy: () => doneResolve?.()
			})
			const frame = new BoxRenderable(renderer, { width: "100%", height: "100%", padding: 1 })
			const body = new TextRenderable(renderer, {
				width: "100%",
				height: "100%",
				content: "Loading bridge operations..."
			})
			frame.add(body)
			renderer.root.add(frame)
			const refresh = async () => {
				const sessions = await store.list()
				const focus = targetId
					? sessions.find((session) => session.id === targetId) ?? null
					: sessions[0] ?? null
				if (targetId && !focus) throw new Error(`Operation ${targetId} not found`)
				let logContent = ""
				if (focus) {
					try {
						logContent = await readFile(focus.logPath, "utf8")
					} catch (error) {
						if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
					}
				}
				body.content = renderTuiSnapshot({ sessions, focus, logContent })
			}
			await refresh()
			const interval = setInterval(
				() =>
					void refresh().catch((error) => {
						body.content = formatErrorMessage(error)
					}),
				2_000
			)
			renderer.addInputHandler((sequence) => {
				if (sequence === "q" || sequence === "Q" || sequence === "\u001b") {
					clearInterval(interval)
					if (!renderer.isDestroyed) renderer.destroy()
					return true
				}
				return false
			})
			renderer.start()
			await done
			clearInterval(interval)
		}
	})
	return command as CommandDef
}

export const createBridgeCliCommand = (): CommandDef =>
	defineCommand({
		meta: {
			name: "zeko-bridge",
			version: "0.0.0",
			description: "Agent-first CLI for bridging between Mina and Zeko."
		},
		subCommands: {
			bridge: createBridgeCommand(),
			deposit: createDepositCommand(),
			withdrawal: createWithdrawalCommand(),
			operation: createOperationCommand(),
			tui: createTuiCommand(),
			doctor: createDoctorCommand()
		}
	})
