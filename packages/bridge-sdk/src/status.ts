import { fetchActionsQuery, networkStateQuery } from "@zeko-labs/graphql"
import { Field, type PublicKey } from "o1js"
import * as v from "valibot"
import type { GqlClient } from "./graphql"
import { fetchCurrentSlot } from "./network"
import type { BridgeRuntime } from "./runtime"

const BLOCK_RANGE_SIZE = 10_000
const ORPHANED_CHAIN_STATUS = "orphaned"

type ParsedActionOutput = {
	blockInfo: {
		timestamp: string
		height: number
		chainStatus: string
		distanceFromMaxBlockHeight?: number | null
	}
	actionData: Array<{
		data: string[]
		transactionInfo?: { hash: string } | null
	}>
}

export type BridgeNetworkState = {
	canonicalMaxBlockHeight: number
	pendingMaxBlockHeight: number
}

const ActionOutputSchema: v.BaseSchema<
	unknown,
	ParsedActionOutput,
	v.BaseIssue<unknown>
> = v.object({
	blockInfo: v.object({
		timestamp: v.string(),
		height: v.number(),
		chainStatus: v.string(),
		distanceFromMaxBlockHeight: v.optional(v.nullable(v.number()))
	}),
	actionData: v.array(
		v.object({
			data: v.array(v.string()),
			transactionInfo: v.optional(v.nullable(v.object({ hash: v.string() })))
		})
	)
})

const ActionOutputsSchema: v.BaseSchema<
	unknown,
	ParsedActionOutput[],
	v.BaseIssue<unknown>
> = v.array(ActionOutputSchema)

const NetworkStateSchema: v.BaseSchema<
	unknown,
	BridgeNetworkState,
	v.BaseIssue<unknown>
> = v.object({
	canonicalMaxBlockHeight: v.number(),
	pendingMaxBlockHeight: v.number()
})

export type BridgeLastCommit = {
	timestamp: string
	timestampIso: string | null
	height: number
	chainStatus: string
	distanceFromMaxBlockHeight: number | null
	transactionHash: string | null
	data: string[]
}

export type BridgeCommitStatusSnapshot = {
	checkedAt: string
	slotStatus: {
		currentSlot: number | null
		withdrawalDelay: number
		depositCommitPastSlot: number | null
	}
	l1: {
		archiveUrl: string
		bridgeContract: string
		networkState: BridgeNetworkState | null
		lastCommit: BridgeLastCommit | null
	}
	sequencer: {
		liveUrl: string
		archiveUrl: string
		sequencerPk: string
		bridgeContract: string
		networkState: BridgeNetworkState | null
		lastCommit: BridgeLastCommit | null
	}
	actionsApi: string
}

const toIsoTimestamp = (timestamp: string): string | null => {
	const value = Number(timestamp)
	return Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null
}

const parseActions = (actions: unknown): ParsedActionOutput[] => {
	const withDefaults = (Array.isArray(actions) ? actions : []).map((action) => ({
		...action,
		actionData: Array.isArray(action?.actionData) ? action.actionData : [],
		blockInfo: {
			timestamp: String(action?.blockInfo?.timestamp ?? "0"),
			height: Number(action?.blockInfo?.height ?? 0),
			chainStatus: String(action?.blockInfo?.chainStatus ?? "canonical"),
			distanceFromMaxBlockHeight:
				action?.blockInfo?.distanceFromMaxBlockHeight === undefined ||
				action?.blockInfo?.distanceFromMaxBlockHeight === null
					? null
					: Number(action.blockInfo.distanceFromMaxBlockHeight)
		}
	}))

	const result = v.safeParse(ActionOutputsSchema, withDefaults)
	if (!result.success) throw new Error("Invalid latest commit actions payload")
	return result.output
}

const isCommitAction = (data: string[]): boolean => {
	const kind = data.at(0)
	if (kind === undefined) return false

	try {
		return Field(kind).equals(Field(0)).toBoolean()
	} catch {
		return false
	}
}

const findLatestCommit = (actions: ParsedActionOutput[]): BridgeLastCommit | null =>
	actions
		.filter((action) => action.blockInfo.chainStatus !== ORPHANED_CHAIN_STATUS)
		.flatMap((action) =>
			action.actionData
				.filter(({ data }) => isCommitAction(data))
				.map(({ data, transactionInfo }) => ({
					timestamp: action.blockInfo.timestamp,
					timestampIso: toIsoTimestamp(action.blockInfo.timestamp),
					height: action.blockInfo.height,
					chainStatus: action.blockInfo.chainStatus,
					distanceFromMaxBlockHeight: action.blockInfo.distanceFromMaxBlockHeight ?? null,
					transactionHash: transactionInfo?.hash ?? null,
					data
				}))
		)
		.sort((a, b) => Number(b.timestamp) - Number(a.timestamp) || b.height - a.height)
		.at(0) ?? null

export async function fetchNetworkState(client: GqlClient): Promise<BridgeNetworkState> {
	const { data, error } = await client().query(networkStateQuery, {})
	if (error) throw error

	const result = v.safeParse(
		NetworkStateSchema,
		data?.networkState?.maxBlockHeight ?? {
			canonicalMaxBlockHeight: 0,
			pendingMaxBlockHeight: 0
		}
	)
	if (!result.success) throw new Error("Invalid network state payload")
	return result.output
}

export async function fetchLastCommit(
	client: GqlClient,
	pk: PublicKey,
	options: { stopAtBlock?: number; toBlock?: number } = {}
): Promise<BridgeLastCommit | null> {
	const networkState = options.toBlock === undefined ? await fetchNetworkState(client) : undefined
	const toBlock = options.toBlock ?? networkState?.pendingMaxBlockHeight ?? 0
	const stopAtBlock = options.stopAtBlock ?? 0

	for (let cursor = toBlock; cursor >= stopAtBlock; ) {
		const from = Math.max(stopAtBlock, cursor - BLOCK_RANGE_SIZE + 1)
		const { data, error } = await client().query(fetchActionsQuery, {
			pk: pk.toBase58(),
			from,
			to: cursor + 1
		})
		if (error) throw error

		const commit = findLatestCommit(parseActions(data?.actions))
		if (commit !== null) return commit

		cursor = from - 1
	}

	return null
}

export async function fetchBridgeCommitStatusSnapshot(
	runtime: BridgeRuntime
): Promise<BridgeCommitStatusSnapshot> {
	const currentSlotPromise = fetchCurrentSlot(runtime)
		.then((slot) => Number(slot.toString()))
		.catch(() => null)
	const [l1NetworkState, l2NetworkState, l1LastCommit, sequencerLastCommit, currentSlot] =
		await Promise.all([
			fetchNetworkState(runtime.l1ArchiveClient).catch(() => null),
			fetchNetworkState(runtime.l2ArchiveClient).catch(() => null),
			fetchLastCommit(runtime.l1ArchiveClient, runtime.outerPk),
			fetchLastCommit(runtime.l2ArchiveClient, runtime.sequencerPk),
			currentSlotPromise
		])
	const withdrawalDelay = Number(runtime.withdrawalDelay.toString())

	return {
		checkedAt: new Date().toISOString(),
		slotStatus: {
			currentSlot,
			withdrawalDelay,
			depositCommitPastSlot:
				currentSlot === null ? null : Math.max(0, currentSlot - withdrawalDelay)
		},
		l1: {
			archiveUrl: runtime.config.l1ArchiveUrl,
			bridgeContract: runtime.outerPk.toBase58(),
			networkState: l1NetworkState,
			lastCommit: l1LastCommit
		},
		sequencer: {
			liveUrl: runtime.config.zekoUrl,
			archiveUrl: runtime.config.zekoArchiveUrl,
			sequencerPk: runtime.sequencerPk.toBase58(),
			bridgeContract: runtime.innerPk.toBase58(),
			networkState: l2NetworkState,
			lastCommit: sequencerLastCommit
		},
		actionsApi: runtime.config.actionsApi
	}
}
