import { defineCommand, type CommandDef } from "citty"
import { readAliasedString, readBoolean, readRequired, readString } from "./args"
import { sortByIndex } from "./decisions"
import { formatRoute, parseChainRef } from "./routes"
import {
	createDefaultBridgeAdapter,
	DIRECT_MUTATION_RETRY_DELAY_MS,
	deriveAccount,
	isRecoverableMutationError,
	resolveDepositTimeoutSlots
} from "./sdk"
import type {
	BridgeAdapter,
	BridgeAdapterFactory,
	ChainRef,
	DepositStatus,
	StatusResult,
	TransactionResult,
	WithdrawalStatus
} from "./types"
import { sleepFor } from "./utils"

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
