import {
  ApolloClient,
  DocumentNode,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client/core";
import {
  AccountUpdate,
  Field,
  Mina,
  PublicKey,
  TokenId,
  Types,
  UInt32,
  UInt64,
} from "o1js";
import {
  AccountQuery,
  accountQuery,
  FetchConfigQuery,
  fetchConfigQuery,
  finalizeDepositMutation,
  GenesisConstants,
  genesisConstantsQuery,
  ProvedForest,
  provedForestQuery,
  RuntimeConfig,
  runtimeConfigQuery,
  SequencerPkQuery,
  sequencerPkQuery,
  submitDepositMutation,
} from "./queries";
import {
  Account,
  Config,
  OuterAction,
  OuterCommit,
  OuterWitness,
} from "./types";
import { Actions, depositAux, fetchActions } from "./utils";

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
    public readonly sequencerPk: PublicKey
  ) {}

  static async init(config: Config): Promise<Bridge> {
    const l1Client = new ApolloClient({
      link: new HttpLink({ uri: config.l1Url }),
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache" },
        query: { fetchPolicy: "no-cache" },
        mutate: { fetchPolicy: "no-cache" },
      },
    });
    const l1ArchiveClient = new ApolloClient({
      link: new HttpLink({ uri: config.l1ArchiveUrl }),
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache" },
        query: { fetchPolicy: "no-cache" },
        mutate: { fetchPolicy: "no-cache" },
      },
    });
    const l2Client = new ApolloClient({
      link: new HttpLink({ uri: config.zekoUrl }),
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache" },
        query: { fetchPolicy: "no-cache" },
        mutate: { fetchPolicy: "no-cache" },
      },
    });

    const {
      data: { circuitsConfig },
    } = await l2Client.query<FetchConfigQuery>({
      query: fetchConfigQuery,
    });

    const {
      data: {
        genesisConstants: { accountCreationFee: l1AccountCreationFee },
      },
    } = await l1Client.query<GenesisConstants>({
      query: genesisConstantsQuery,
    });

    const {
      data: {
        genesisConstants: { accountCreationFee: l2AccountCreationFee },
      },
    } = await l2Client.query<GenesisConstants>({
      query: genesisConstantsQuery,
    });

    const {
      data: { sequencerPk },
    } = await l2Client.query<SequencerPkQuery>({
      query: sequencerPkQuery,
    });

    return new Bridge(
      config,
      l1Client,
      l1ArchiveClient,
      l2Client,
      UInt64.from(l1AccountCreationFee),
      UInt64.from(l2AccountCreationFee),
      PublicKey.fromBase58(circuitsConfig.zekoL1),
      PublicKey.fromBase58(circuitsConfig.zekoL2),
      circuitsConfig.holderAccountsL1.map(holder =>
        PublicKey.fromBase58(holder)
      ),
      PublicKey.fromBase58(circuitsConfig.holderAccountL2),
      PublicKey.fromBase58(circuitsConfig.helperTokenOwnerL1),
      PublicKey.fromBase58(sequencerPk)
    );
  }

  private setL1() {
    Mina.setActiveInstance(
      Mina.Network({
        mina: this.config.l1Url,
        archive: this.config.l1ArchiveUrl,
        networkId: this.config.l1Network,
      })
    );
  }

  private setL2() {
    Mina.setActiveInstance(
      Mina.Network({
        mina: this.config.zekoUrl,
        archive: this.config.zekoUrl,
        networkId: this.config.l2Network,
      })
    );
  }

  async fetchOuterActions(
    pk: PublicKey,
    actionStates?: Mina.ActionStates
  ): Promise<OuterAction[]> {
    const actions = await fetchActions(this.l1ArchiveClient, pk, actionStates);

    return actions.map(({ beforeActionState, afterActionState, action }) => {
      if (action[0].equals(0).toBoolean()) {
        return {
          type: "commit",
          action: { beforeActionState, afterActionState, action },
        };
      } else {
        return {
          type: "witness",
          aux: action[1],
          action: { beforeActionState, afterActionState, action },
        };
      }
    });
  }

  private async pollQuery(
    mutation: DocumentNode,
    variables: Record<string, unknown>,
    pollPeriod: number = 1_000
  ) {
    const result = await this.l2Client.mutate<{ request: { key: string } }>({
      mutation,
      variables,
    });

    const key = result.data!.request.key;

    let provedForest: string | null = null;
    let attempts = 0;

    while (!provedForest) {
      if (attempts > (this.config.pollTimeout ?? 30_000) / pollPeriod) {
        throw new Error("Failed to fetch proved forest");
      }

      await new Promise(resolve => setTimeout(resolve, pollPeriod));
      attempts++;

      const resultResponse = await this.l2Client.query<ProvedForest>({
        query: provedForestQuery,
        variables: { key },
      });

      provedForest = resultResponse.data.provedForest;
    }

    return (JSON.parse(provedForest) as Types.Json.AccountUpdate[]).map(
      AccountUpdate.fromJSON
    );
  }

  async fetchCurrentSlot() {
    const {
      data: { runtimeConfig },
    } = await this.l1Client.query<RuntimeConfig>({
      query: runtimeConfigQuery,
    });

    const currentTimestamp = Date.now() / 1000;
    const forkSlot = runtimeConfig.proof.fork.global_slot_since_genesis;
    const genesisTimestamp =
      Date.parse(runtimeConfig.genesis.genesis_state_timestamp) / 1000;

    return UInt32.from(
      Math.floor(forkSlot + (currentTimestamp - genesisTimestamp) / 180)
    );
  }

  async submitDeposit(
    feePayer: Mina.FeePayerSpec,
    {
      recipient,
      amount,
      timeout,
      holderAccountL1,
    }: {
      recipient: PublicKey;
      amount: UInt64;
      timeout: UInt32;
      holderAccountL1: PublicKey;
    }
  ) {
    this.setL1();

    const txn = await Mina.transaction(feePayer, async () => {
      const transferrer = AccountUpdate.createSigned(recipient);
      transferrer.balance.subInPlace(amount);
      transferrer.body.actions = Actions.pushAction(transferrer.body.actions, [
        ...recipient.toFields(),
        ...amount.toFields(),
        ...timeout.toFields(),
        ...holderAccountL1.toFields(),
        ...this.outerPk.toFields(),
      ]);
    });

    const depositForest = await this.pollQuery(submitDepositMutation, {
      depositParams: {
        recipient,
        amount,
        timeout: +timeout.toString(),
        holderAccountL1,
        children: "[]",
      },
    });

    txn.transaction.accountUpdates.push(...depositForest);

    return txn;
  }

  async findDeposits(pk: PublicKey) {
    const outerActions = await fetchActions(this.l1ArchiveClient, pk);
    const currentSlot = await this.fetchCurrentSlot();

    return outerActions
      .map(({ beforeActionState, afterActionState, action }) => {
        const [
          recipient1,
          recipient2,
          amount1,
          timeout1,
          holderAccount1,
          holderAccount2,
          outer1,
          outer2,
        ] = action;

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
          return null;

        const recipient = PublicKey.fromFields([recipient1, recipient2]);
        const amount = UInt64.fromFields([amount1]);
        const timeout = UInt32.fromFields([timeout1]);
        const holderAccountL1 = PublicKey.fromFields([
          holderAccount1,
          holderAccount2,
        ]);
        const outerPk = PublicKey.fromFields([outer1, outer2]);

        if (!outerPk.equals(this.outerPk).toBoolean()) return null;

        if (
          !this.outerHolders.some(holder =>
            holder.equals(holderAccountL1).toBoolean()
          )
        )
          return null;

        return {
          beforeActionState,
          afterActionState,
          recipient,
          amount,
          timeout,
          holderAccountL1,
          outerPk,
          timedOut: timeout.lessThan(currentSlot).toBoolean(),
        };
      })
      .filter(Boolean) as {
      beforeActionState: Field;
      afterActionState: Field;
      recipient: PublicKey;
      amount: UInt64;
      timeout: UInt32;
      holderAccountL1: PublicKey;
      outerPk: PublicKey;
      timedOut: boolean;
    }[];
  }

  async fetchAccount(
    client: ApolloClient<NormalizedCacheObject>,
    pk: PublicKey,
    tokenId?: Field
  ) {
    const {
      data: { account },
    } = await client.query<AccountQuery>({
      query: accountQuery,
      variables: { pk, tokenId: tokenId ? TokenId.toBase58(tokenId) : null },
    });

    return account;
  }

  async getNextDepositIndex(helperAccount: Account) {
    const nextDepositIndex = helperAccount.zkappState?.at(0);
    return UInt32.from(nextDepositIndex ?? 0);
  }

  async fetchSyncedOuterActionState() {
    const innerAccount = await this.fetchAccount(this.l2Client, this.innerPk);

    if (!innerAccount) throw new Error("Inner account not found");

    return {
      state: Field.from(innerAccount.zkappState![0]),
      length: UInt32.from(innerAccount.zkappState![1]),
    };
  }

  async finalizeDeposit(pk: PublicKey, fee: UInt64 = UInt64.zero) {
    const helperAccount = await this.fetchAccount(
      this.l2Client,
      pk,
      TokenId.derive(this.innerHolder)
    );

    const prevNextDeposit = helperAccount
      ? await this.getNextDepositIndex(helperAccount)
      : UInt32.zero;

    const outerActions = await this.fetchOuterActions(this.outerPk);

    const deposits = (await this.findDeposits(pk)).map(deposit => ({
      deposit: deposit,
      aux: depositAux(deposit),
    }));

    const findMatchingDeposit = (action: OuterWitness) =>
      deposits.find(
        ({ aux, deposit: { timedOut } }) =>
          aux.equals(action.aux).toBoolean() && !timedOut
      );

    const myDepositIndex = outerActions.findIndex((action, index) => {
      if (action.type === "commit") return false;

      const matchingDeposit = findMatchingDeposit(action);

      if (!matchingDeposit) return false;

      if (prevNextDeposit.greaterThan(UInt32.from(index)).toBoolean())
        return false;

      return true;
    });

    if (myDepositIndex === -1)
      throw new Error("Did not find any deposit to finalize");

    const myDeposit = outerActions[myDepositIndex] as OuterWitness;

    const nextCommitIndex = outerActions.findIndex((action, index) => {
      if (action.type !== "commit") return false;

      if (myDepositIndex >= index) return false;

      return true;
    });

    if (nextCommitIndex === -1) throw new Error("Next commit not found");

    const nextCommit = outerActions[nextCommitIndex] as OuterCommit;

    const depositParams = findMatchingDeposit(myDeposit)!;

    const syncedOuterActionState = await this.fetchSyncedOuterActionState();

    const syncedOuterActionStateIndex = outerActions.findIndex(({ action }) =>
      action.afterActionState.equals(syncedOuterActionState.state).toBoolean()
    );

    if (
      syncedOuterActionStateIndex === -1 ||
      syncedOuterActionStateIndex < nextCommitIndex
    )
      throw new Error("Next commit has not been synced");

    const aseElems = outerActions
      .slice(nextCommitIndex + 1, syncedOuterActionStateIndex + 1)
      .map(({ action }) => Actions.fromList([action.action]).hash);

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
              children: "[]",
            },
          },
        },
        ase: {
          stmt: {
            length: syncedOuterActionState.length.sub(aseElems.length),
            actionState: nextCommit.action.afterActionState,
          },
          fields: aseElems,
        },
      },
    });

    for (let i = 0; i < depositForest.length; i++) {
      if (!depositForest[i].publicKey.equals(pk).toBoolean()) continue;

      depositForest[i].lazyAuthorization = { kind: "lazy-signature" };
    }

    this.setL2();

    const accountCreationFee = helperAccount
      ? UInt64.zero
      : this.l2AccountCreationFee.mul(2);

    const txn = await Mina.transaction(
      {
        sender: this.sequencerPk,
        fee,
      },
      async () => {
        const transferrer = AccountUpdate.create(
          depositParams.deposit.recipient
        );
        transferrer.balance.addInPlace(
          depositParams.deposit.amount.sub(accountCreationFee)
        );
      }
    );

    txn.transaction.accountUpdates.push(...depositForest);

    return txn;
  }
}
