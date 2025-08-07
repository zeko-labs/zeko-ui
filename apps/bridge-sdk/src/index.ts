import {
	ApolloClient,
	DocumentNode,
	HttpLink,
	InMemoryCache,
	NormalizedCacheObject
} from "@apollo/client/core"
import { AccountUpdate, Field, Mina, PublicKey, TokenId, Types, UInt32, UInt64 } from "o1js"
import {
	accountQuery,
	AccountQuery,
	FetchConfigQuery,
	fetchConfigQuery,
	finalizeDepositMutation,
	finalizeWithdrawalMutation,
	GenesisConstants,
	genesisConstantsQuery,
	ProvedForest,
	provedForestQuery,
	RuntimeConfig,
	runtimeConfigQuery,
	SequencerPkQuery,
	sequencerPkQuery,
	submitDepositMutation,
	submitWithdrawalMutation
} from "./queries"
import {
	Account,
	Config,
	InnerAction,
	InnerWitness,
	OuterAction,
	OuterCommit,
	OuterWitness
} from "./types"
import { Actions, depositAux, fetchActions, withdrawalAux } from "./utils"

export class Bridge {
	constructor(
		private readonly config: Config,

		private readonly l1Client: ApolloClient<NormalizedCacheObject>,
		private readonly l1ArchiveClient: ApolloClient<NormalizedCacheObject>,
		private readonly l2Client: ApolloClient<NormalizedCacheObject>,

		public readonly l1AccountCreationFee: UInt64,
		public readonly l2AccountCreationFee: UInt64,

		public readonly outerPk: PublicKey,
		public readonly innerPk: PublicKey,
		public readonly outerHolders: PublicKey[],
		public readonly innerHolder: PublicKey,
		public readonly outerTokenOwner: PublicKey,
		public readonly sequencerPk: PublicKey,
		public readonly withdrawalDelay: UInt32
	) {}

	static async init(config: Config): Promise<Bridge> {
		const l1Client = new ApolloClient({
			link: new HttpLink({ uri: config.l1Url }),
			cache: new InMemoryCache(),
			defaultOptions: {
				watchQuery: { fetchPolicy: "no-cache" },
				query: { fetchPolicy: "no-cache" },
				mutate: { fetchPolicy: "no-cache" }
			}
		})
		const l1ArchiveClient = new ApolloClient({
			link: new HttpLink({ uri: config.l1ArchiveUrl }),
			cache: new InMemoryCache(),
			defaultOptions: {
				watchQuery: { fetchPolicy: "no-cache" },
				query: { fetchPolicy: "no-cache" },
				mutate: { fetchPolicy: "no-cache" }
			}
		})
		const l2Client = new ApolloClient({
			link: new HttpLink({ uri: config.zekoUrl }),
			cache: new InMemoryCache(),
			defaultOptions: {
				watchQuery: { fetchPolicy: "no-cache" },
				query: { fetchPolicy: "no-cache" },
				mutate: { fetchPolicy: "no-cache" }
			}
		})

		const {
			data: { circuitsConfig }
		} = await l2Client.query<FetchConfigQuery>({
			query: fetchConfigQuery
		})

		const {
			data: {
				genesisConstants: { accountCreationFee: l1AccountCreationFee }
			}
		} = await l1Client.query<GenesisConstants>({
			query: genesisConstantsQuery
		})

		const {
			data: {
				genesisConstants: { accountCreationFee: l2AccountCreationFee }
			}
		} = await l2Client.query<GenesisConstants>({
			query: genesisConstantsQuery
		})

		const {
			data: { sequencerPk }
		} = await l2Client.query<SequencerPkQuery>({
			query: sequencerPkQuery
		})

		return new Bridge(
			config,
			l1Client,
			l1ArchiveClient,
			l2Client,
			UInt64.from(l1AccountCreationFee),
			UInt64.from(l2AccountCreationFee),
			PublicKey.fromBase58(circuitsConfig.zekoL1),
			PublicKey.fromBase58(circuitsConfig.zekoL2),
			circuitsConfig.holderAccountsL1.map((holder) => PublicKey.fromBase58(holder)),
			PublicKey.fromBase58(circuitsConfig.holderAccountL2),
			PublicKey.fromBase58(circuitsConfig.helperTokenOwnerL1),
			PublicKey.fromBase58(sequencerPk),
			UInt32.from(circuitsConfig.withdrawalDelay)
		)
	}

	public setL1() {
		Mina.setActiveInstance(
			Mina.Network({
				mina: this.config.l1Url,
				archive: this.config.l1ArchiveUrl,
				networkId: this.config.l1Network
			})
		)
	}

	public setL2() {
		Mina.setActiveInstance(
			Mina.Network({
				mina: this.config.zekoUrl,
				archive: this.config.zekoUrl,
				networkId: this.config.l2Network
			})
		)
	}

	public async fetchCurrentSlot() {
		const {
			data: { runtimeConfig }
		} = await this.l1Client.query<RuntimeConfig>({
			query: runtimeConfigQuery
		})

		const currentTimestamp = Date.now() / 1000
		const forkSlot = runtimeConfig.proof.fork.global_slot_since_genesis
		const genesisTimestamp = Date.parse(runtimeConfig.genesis.genesis_state_timestamp) / 1000

		return UInt32.from(Math.floor(forkSlot + (currentTimestamp - genesisTimestamp) / 180))
	}

	public async fetchAccount(
		client: ApolloClient<NormalizedCacheObject>,
		pk: PublicKey,
		tokenId?: Field
	) {
		const {
			data: { account }
		} = await client.query<AccountQuery>({
			query: accountQuery,
			variables: { pk, tokenId: tokenId ? TokenId.toBase58(tokenId) : null }
		})

		return account
	}

	public async fetchOuterActions(
		pk: PublicKey,
		actionStates?: Mina.ActionStates
	): Promise<OuterAction[]> {
		const actions = await fetchActions(this.l1ArchiveClient, pk, actionStates)
		const currentSlot = await this.fetchCurrentSlot()

		return actions.map(({ beforeActionState, afterActionState, action }) => {
			if (action[0].equals(0).toBoolean()) {
				return {
					type: "commit",
					ledger: action[1],
					innerActionState: action[2],
					innerActionStateLength: UInt32.fromFields([action[3]]),
					synchronizedOuterActionState: action[4],
					synchronizedOuterActionStateLength: UInt32.fromFields([action[5]]),
					slotRange: {
						lower: UInt32.fromFields([action[6]]),
						upper: UInt32.fromFields([action[7]])
					},
					isPastWithdrawalDelay: currentSlot
						.greaterThan(UInt32.fromFields([action[7]]).add(this.withdrawalDelay))
						.toBoolean(),
					action: { beforeActionState, afterActionState, action }
				}
			} else if (action[0].equals(1).toBoolean()) {
				return {
					type: "witness",
					aux: action[1],
					action: { beforeActionState, afterActionState, action }
				}
			} else throw new Error("Invalid outer action type")
		})
	}

	public async fetchInnerActions(
		pk: PublicKey,
		actionStates?: Mina.ActionStates
	): Promise<InnerAction[]> {
		const actions = await fetchActions(this.l2Client, pk, actionStates)

		return actions.map(({ beforeActionState, afterActionState, action }) => {
			if (action[0].equals(0).toBoolean()) {
				return {
					type: "witness",
					aux: action[1],
					action: { beforeActionState, afterActionState, action }
				}
			} else throw new Error("Invalid inner action type")
		})
	}

	private async pollQuery(
		mutation: DocumentNode,
		variables: Record<string, unknown>,
		pollPeriod: number = 1_000
	) {
		const result = await this.l2Client.mutate<{ request: { key: string } }>({
			mutation,
			variables
		})

		const key = result.data!.request.key

		let provedForest: string | null = null
		let attempts = 0

		while (!provedForest) {
			if (attempts > (this.config.pollTimeout ?? 30_000) / pollPeriod) {
				throw new Error("Failed to fetch proved forest")
			}

			await new Promise((resolve) => setTimeout(resolve, pollPeriod))
			attempts++

			const resultResponse = await this.l2Client.query<ProvedForest>({
				query: provedForestQuery,
				variables: { key }
			})

			provedForest = resultResponse.data.provedForest
		}

		return (JSON.parse(provedForest) as Types.Json.AccountUpdate[]).map(AccountUpdate.fromJSON)
	}

	public async submitDeposit(
		feePayer: Mina.FeePayerSpec,
		{
			recipient,
			amount,
			timeout,
			holderAccountL1
		}: {
			recipient: PublicKey
			amount: UInt64
			timeout: UInt32
			holderAccountL1: PublicKey
		}
	) {
		this.setL1()

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount)
			transferrer.body.actions = Actions.pushAction(transferrer.body.actions, [
				...recipient.toFields(),
				...amount.toFields(),
				...timeout.toFields(),
				...holderAccountL1.toFields(),
				...this.outerPk.toFields()
			])
		})

		const depositForest = await this.pollQuery(submitDepositMutation, {
			depositParams: {
				recipient,
				amount,
				timeout: +timeout.toString(),
				holderAccountL1,
				children: "[]"
			}
		})

		txn.transaction.accountUpdates.push(...depositForest)

		return txn
	}

	public async findDeposits(pk: PublicKey) {
		const userOuterActions = await fetchActions(this.l1ArchiveClient, pk)
		const currentSlot = await this.fetchCurrentSlot()

		return userOuterActions
			.map(({ beforeActionState, afterActionState, action }) => {
				const [
					recipient1,
					recipient2,
					amount1,
					timeout1,
					holderAccount1,
					holderAccount2,
					outer1,
					outer2
				] = action

				if (
					!recipient1 ||
					!recipient2 ||
					!amount1 ||
					!timeout1 ||
					!holderAccount1 ||
					!holderAccount2 ||
					!outer1 ||
					!outer2
				)
					return null

				const recipient = PublicKey.fromFields([recipient1, recipient2])
				const amount = UInt64.fromFields([amount1])
				const timeout = UInt32.fromFields([timeout1])
				const holderAccountL1 = PublicKey.fromFields([holderAccount1, holderAccount2])
				const outerPk = PublicKey.fromFields([outer1, outer2])

				if (!outerPk.equals(this.outerPk).toBoolean()) return null

				if (!this.outerHolders.some((holder) => holder.equals(holderAccountL1).toBoolean()))
					return null

				return {
					beforeActionState,
					afterActionState,
					recipient,
					amount,
					timeout,
					holderAccountL1,
					outerPk,
					timedOut: timeout.lessThan(currentSlot).toBoolean()
				}
			})
			.filter(Boolean) as {
			beforeActionState: Field
			afterActionState: Field
			recipient: PublicKey
			amount: UInt64
			timeout: UInt32
			holderAccountL1: PublicKey
			outerPk: PublicKey
			timedOut: boolean
		}[]
	}

	public async getNextDepositIndex(helperAccount: Account) {
		const nextDepositIndex = helperAccount.zkappState?.at(0)
		return UInt32.from(nextDepositIndex ?? 0)
	}

	public async fetchSyncedOuterActionState() {
		const innerAccount = await this.fetchAccount(this.l2Client, this.innerPk)

		if (!innerAccount) throw new Error("Inner account not found")

		return {
			state: Field.from(innerAccount.zkappState![0]),
			length: UInt32.from(innerAccount.zkappState![1])
		}
	}

	public async finalizeDeposit(pk: PublicKey, fee: UInt64 = UInt64.zero) {
		const helperAccount = await this.fetchAccount(
			this.l2Client,
			pk,
			TokenId.derive(this.innerHolder)
		)

		const prevNextDeposit = helperAccount
			? await this.getNextDepositIndex(helperAccount)
			: UInt32.zero

		const outerActions = await this.fetchOuterActions(this.outerPk)

		const deposits = (await this.findDeposits(pk)).map((deposit) => ({
			deposit,
			aux: depositAux(deposit)
		}))

		const findMatchingDeposit = (action: OuterWitness) =>
			deposits.find(
				({ aux, deposit: { timedOut } }) => aux.equals(action.aux).toBoolean() && !timedOut
			)

		const myDepositIndex = outerActions.findIndex((action, index) => {
			if (action.type === "commit") return false

			const matchingDeposit = findMatchingDeposit(action)

			if (!matchingDeposit) return false

			if (prevNextDeposit.greaterThan(UInt32.from(index)).toBoolean()) return false

			return true
		})

		if (myDepositIndex === -1) throw new Error("Did not find any deposit to finalize")

		const myDeposit = outerActions[myDepositIndex] as OuterWitness

		const nextCommitIndex = outerActions.findIndex((action, index) => {
			if (action.type !== "commit") return false

			if (myDepositIndex >= index) return false

			return true
		})

		if (nextCommitIndex === -1) throw new Error("Next commit not found")

		const nextCommit = outerActions[nextCommitIndex] as OuterCommit

		const depositParams = findMatchingDeposit(myDeposit)!

		const syncedOuterActionState = await this.fetchSyncedOuterActionState()

		const syncedOuterActionStateIndex = outerActions.findIndex(({ action }) =>
			action.afterActionState.equals(syncedOuterActionState.state).toBoolean()
		)

		if (syncedOuterActionStateIndex === -1 || syncedOuterActionStateIndex < nextCommitIndex)
			throw new Error("Next commit has not been synced")

		const aseElems = outerActions
			.slice(nextCommitIndex + 1, syncedOuterActionStateIndex + 1)
			.map(({ action }) => Actions.fromList([action.action]).hash)

		let depositForest = await this.pollQuery(finalizeDepositMutation, {
			input: {
				prevNextDeposit,
				checkAccepted: {
					elems: outerActions
						.slice(myDepositIndex, nextCommitIndex + 1)
						.map(({ action }) => ({ actions: action.action })),
					init: {
						depositIndex: myDepositIndex,
						orignalActionState: myDeposit.action.beforeActionState,
						params: {
							...depositParams.deposit,
							timeout: +depositParams.deposit.timeout,
							children: "[]"
						}
					}
				},
				ase: {
					stmt: {
						length: syncedOuterActionState.length.sub(aseElems.length),
						actionState: nextCommit.action.afterActionState
					},
					fields: aseElems
				}
			}
		})

		for (let i = 0; i < depositForest.length; i++) {
			if (!depositForest[i].publicKey.equals(pk).toBoolean()) continue

			depositForest[i].lazyAuthorization = { kind: "lazy-signature" }
		}

		this.setL2()

		const accountCreationFee = helperAccount ? UInt64.zero : this.l2AccountCreationFee.mul(2)

		const txn = await Mina.transaction(
			{
				sender: this.sequencerPk,
				fee
			},
			async () => {
				const transferrer = AccountUpdate.create(depositParams.deposit.recipient)
				transferrer.balance.addInPlace(depositParams.deposit.amount.sub(accountCreationFee))
			}
		)

		txn.transaction.accountUpdates.push(...depositForest)

		return txn
	}

	public async submitWithdrawal(
		feePayer: Mina.FeePayerSpec,
		{
			recipient,
			amount
		}: {
			recipient: PublicKey
			amount: UInt64
		}
	) {
		this.setL2()

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.createSigned(recipient)
			transferrer.balance.subInPlace(amount)
			transferrer.body.actions = Actions.pushAction(transferrer.body.actions, [
				...recipient.toFields(),
				...amount.toFields()
			])
		})

		const withdrawalForest = await this.pollQuery(submitWithdrawalMutation, {
			input: { recipient, amount, children: "[]" }
		})

		txn.transaction.accountUpdates.push(...withdrawalForest)

		return txn
	}

	public async findWithdrawals(pk: PublicKey) {
		const userInnerActions = await fetchActions(this.l2Client, pk)

		return userInnerActions
			.map(({ beforeActionState, afterActionState, action }) => {
				const [recipient1, recipient2, amount1] = action

				if (!recipient1 || !recipient2 || !amount1) return null

				const recipient = PublicKey.fromFields([recipient1, recipient2])
				const amount = UInt64.fromFields([amount1])

				return {
					beforeActionState,
					afterActionState,
					recipient,
					amount
				}
			})
			.filter(Boolean) as {
			beforeActionState: Field
			afterActionState: Field
			recipient: PublicKey
			amount: UInt64
		}[]
	}

	public async getNextWithdrawalIndex(helperAccount: Account) {
		const nextWithdrawalIndex = helperAccount.zkappState?.at(1)
		return UInt32.from(nextWithdrawalIndex ?? 0)
	}

	public async finalizeWithdrawal(
		pk: PublicKey,
		feePayer: Mina.FeePayerSpec,
		outerHolder: PublicKey
	) {
		const helperAccount = await this.fetchAccount(
			this.l1Client,
			pk,
			TokenId.derive(this.outerTokenOwner)
		)

		const prevNextWithdrawal = helperAccount
			? await this.getNextWithdrawalIndex(helperAccount)
			: UInt32.zero

		const innerActions = await this.fetchInnerActions(this.innerPk)

		const withdrawals = (await this.findWithdrawals(pk)).map((withdrawal) => ({
			withdrawal,
			aux: withdrawalAux(withdrawal)
		}))

		const findMatchingWithdrawal = (action: InnerWitness) =>
			withdrawals.find(({ aux }) => aux.equals(action.aux).toBoolean())

		const myWithdrawalIndex = innerActions.findIndex((action, index) => {
			const matchingWithdrawal = findMatchingWithdrawal(action)

			if (!matchingWithdrawal) return false

			if (prevNextWithdrawal.greaterThan(UInt32.from(index)).toBoolean()) return false

			return true
		})

		if (myWithdrawalIndex === -1) throw new Error("Did not find any withdrawal to finalize")

		const myWithdrawal = innerActions[myWithdrawalIndex]
		const withdrawalParams = findMatchingWithdrawal(myWithdrawal)!

		const outerActions = await this.fetchOuterActions(this.outerPk)

		const reversedOuterActions = outerActions.slice().reverse()
		const reversedLastCommitIndex = reversedOuterActions.findIndex((action) => {
			if (action.type !== "commit") return false

			if (!action.isPastWithdrawalDelay) return false

			return true
		})

		if (reversedLastCommitIndex === -1) throw new Error("Last commit not found")

		const lastCommitIndex = outerActions.length - reversedLastCommitIndex - 1
		const lastCommit = outerActions[lastCommitIndex] as OuterCommit

		const lastCommitAse = outerActions
			.slice(lastCommitIndex + 1, outerActions.length)
			.map(({ action }) => Actions.fromList([action.action]).hash)

		const syncedInnerActionStateIndex = innerActions.findIndex(({ action }) =>
			action.afterActionState.equals(lastCommit.innerActionState).toBoolean()
		)

		if (syncedInnerActionStateIndex === -1 || syncedInnerActionStateIndex < myWithdrawalIndex)
			throw new Error("Withdrawal has not been synced")

		const withdrawalAse = innerActions
			.slice(myWithdrawalIndex + 1, syncedInnerActionStateIndex + 1)
			.map(({ action }) => Actions.fromList([action.action]).hash)

		let withdrawalForest = await this.pollQuery(finalizeWithdrawalMutation, {
			input: {
				withdrawalParams: {
					...withdrawalParams.withdrawal,
					children: "[]"
				},
				prevNextWithdrawal,
				withdrawalAse: {
					fields: withdrawalAse,
					stmt: {
						length: lastCommit.innerActionStateLength.sub(withdrawalAse.length),
						actionState: myWithdrawal.action.afterActionState
					}
				},
				beforeWithdrawal: {
					actionState: myWithdrawal.action.beforeActionState
				},
				commitAse: {
					fields: lastCommitAse,
					stmt: { actionState: lastCommit.action.afterActionState }
				},
				commit: {
					actions: lastCommit.action.action
				},
				beforeCommit: { actionState: lastCommit.action.beforeActionState },
				publicKey: outerHolder
			}
		})

		for (let i = 0; i < withdrawalForest.length; i++) {
			if (!withdrawalForest[i].publicKey.equals(pk).toBoolean()) continue

			withdrawalForest[i].lazyAuthorization = { kind: "lazy-signature" }
		}

		this.setL1()

		const accountCreationFee = helperAccount ? UInt64.zero : this.l1AccountCreationFee

		const txn = await Mina.transaction(feePayer, async () => {
			const transferrer = AccountUpdate.create(withdrawalParams.withdrawal.recipient)
			transferrer.balance.addInPlace(withdrawalParams.withdrawal.amount.sub(accountCreationFee))
		})

		txn.transaction.accountUpdates.push(...withdrawalForest)

		return txn
	}
}
