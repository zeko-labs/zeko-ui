import { defineCommand, type CommandDef } from "citty"
import type { BridgeAdapter } from "../core/adapter"
import type { ChainRef } from "../core/routes"
import { resolveRoute } from "../core/routes"
import type {
	DepositStatus,
	StatusResult,
	TransactionResult,
	WithdrawalStatus
} from "../core/types"

type StatusArgs = {
	account: string
	from: ChainRef
	to: ChainRef
	latest: boolean
}

type DirectCommandDeps = {
	createAdapter?: (input: { from: ChainRef; to: ChainRef }) =>
		| Promise<BridgeAdapter>
		| BridgeAdapter
	write?: (message: string) => void
}

const defaultCreateAdapter = async ({
	from,
	to
}: {
	from: ChainRef
	to: ChainRef
}): Promise<BridgeAdapter> => {
	const { createBridgeAdapter } = await import("../core/adapter")
	return createBridgeAdapter({ route: resolveRoute(from, to) })
}

const selectLatest = <T extends { index: number }>(items: T[], latest: boolean): T[] =>
	latest ? [...items].sort((left, right) => right.index - left.index).slice(0, 1) : items

export const runDepositStatus = async (
	input: StatusArgs,
	{
		adapter
	}: {
		adapter: Pick<BridgeAdapter, "getDepositStatuses">
	}
): Promise<StatusResult<DepositStatus>> => {
	const operations = selectLatest(await adapter.getDepositStatuses(input.account), input.latest)
	return {
		success: true,
		direction: "deposit",
		route: `${input.from}->${input.to}`,
		account: input.account,
		count: operations.length,
		operations
	}
}

export const runWithdrawalStatus = async (
	input: StatusArgs,
	{
		adapter
	}: {
		adapter: Pick<BridgeAdapter, "getWithdrawalStatuses">
	}
): Promise<StatusResult<WithdrawalStatus>> => {
	const operations = selectLatest(await adapter.getWithdrawalStatuses(input.account), input.latest)
	return {
		success: true,
		direction: "withdrawal",
		route: `${input.from}->${input.to}`,
		account: input.account,
		count: operations.length,
		operations
	}
}

const renderStatus = <T extends { index: number; hash: string; amount: string; recipient: string }>(
	result: StatusResult<T>
): string =>
	[
		`${result.direction} status for ${result.account}`,
		`Route: ${result.route}`,
		`Count: ${result.count}`,
		...result.operations.map(
			(item) => `#${item.index} amount=${item.amount} recipient=${item.recipient} hash=${item.hash}`
		)
	].join("\n")

const renderTransaction = (result: TransactionResult): string =>
	[
		`${result.direction} ${result.action} sent`,
		`Route: ${result.route}`,
		`Hash: ${result.hash}`,
		`Included: ${result.included ? "yes" : "no"}`,
		`Explorer: ${result.explorerUrl}`
	].join("\n")

const routeArgs = (defaults: { from: ChainRef; to: ChainRef }) => ({
	from: {
		type: "string" as const,
		default: defaults.from
	},
	to: {
		type: "string" as const,
		default: defaults.to
	},
	json: {
		type: "boolean" as const,
		default: false
	}
})

const writeResult = ({
	json,
	result,
	write
}: {
	json: boolean
	result: StatusResult<DepositStatus | WithdrawalStatus> | TransactionResult
	write: (message: string) => void
}) => {
	if (json) {
		write(JSON.stringify(result, null, 2))
		return
	}

	if ("action" in result) {
		write(renderTransaction(result))
		return
	}

	write(renderStatus(result))
}

export const createDepositCommand = (deps: DirectCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: {
			name: "deposit",
			description: "Perform deposit-level bridge operations."
		},
		subCommands: {
			submit: defineCommand({
				meta: {
					name: "submit",
					description: "Submit a deposit transaction."
				},
				args: {
					...routeArgs({ from: "mina:testnet", to: "zeko:testnet" }),
					account: { type: "string", required: false },
					amount: { type: "string", required: true },
					timeoutSlots: { type: "string", required: false },
					wait: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await adapter.submitDeposit({
						account: args.account as string | undefined,
						amount: args.amount as string,
						timeoutSlots:
							typeof args.timeoutSlots === "string" ? Number(args.timeoutSlots) : undefined,
						wait: args.wait as boolean
					})
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			}),
			finalize: defineCommand({
				meta: {
					name: "finalize",
					description: "Finalize the next eligible deposit."
				},
				args: {
					...routeArgs({ from: "mina:testnet", to: "zeko:testnet" }),
					account: { type: "string", required: false },
					wait: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await adapter.finalizeDeposit({
						account: args.account as string | undefined,
						wait: args.wait as boolean
					})
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			}),
			cancel: defineCommand({
				meta: {
					name: "cancel",
					description: "Cancel the next eligible deposit."
				},
				args: {
					...routeArgs({ from: "mina:testnet", to: "zeko:testnet" }),
					account: { type: "string", required: false },
					wait: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await adapter.cancelDeposit({
						account: args.account as string | undefined,
						wait: args.wait as boolean
					})
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			}),
			status: defineCommand({
				meta: {
					name: "status",
					description: "List deposit operations for an account."
				},
				args: {
					...routeArgs({ from: "mina:testnet", to: "zeko:testnet" }),
					account: { type: "string", required: true },
					latest: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await runDepositStatus(
						{
							account: args.account as string,
							from: args.from as ChainRef,
							to: args.to as ChainRef,
							latest: args.latest as boolean
						},
						{ adapter }
					)
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			})
		}
	})

export const createWithdrawalCommand = (deps: DirectCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: {
			name: "withdrawal",
			description: "Perform withdrawal-level bridge operations."
		},
		subCommands: {
			submit: defineCommand({
				meta: {
					name: "submit",
					description: "Submit a withdrawal transaction."
				},
				args: {
					...routeArgs({ from: "zeko:testnet", to: "mina:testnet" }),
					account: { type: "string", required: false },
					amount: { type: "string", required: true },
					wait: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await adapter.submitWithdrawal({
						account: args.account as string | undefined,
						amount: args.amount as string,
						wait: args.wait as boolean
					})
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			}),
			finalize: defineCommand({
				meta: {
					name: "finalize",
					description: "Finalize the next eligible withdrawal."
				},
				args: {
					...routeArgs({ from: "zeko:testnet", to: "mina:testnet" }),
					account: { type: "string", required: false },
					wait: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await adapter.finalizeWithdrawal({
						account: args.account as string | undefined,
						wait: args.wait as boolean
					})
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			}),
			status: defineCommand({
				meta: {
					name: "status",
					description: "List withdrawal operations for an account."
				},
				args: {
					...routeArgs({ from: "zeko:testnet", to: "mina:testnet" }),
					account: { type: "string", required: true },
					latest: { type: "boolean", default: true }
				},
				async run({ args }) {
					const adapter = await (deps.createAdapter ?? defaultCreateAdapter)({
						from: args.from as ChainRef,
						to: args.to as ChainRef
					})
					const result = await runWithdrawalStatus(
						{
							account: args.account as string,
							from: args.from as ChainRef,
							to: args.to as ChainRef,
							latest: args.latest as boolean
						},
						{ adapter }
					)
					writeResult({ json: args.json as boolean, result, write: deps.write ?? console.log })
				}
			})
		}
	})
