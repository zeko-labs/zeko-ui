this is the code for deposit request:

```ts
const sequencerUrl = "https://devnet.zeko.io/graphql"

const main = async () => {
	Mina.setActiveInstance(
		Mina.Network({
			networkId: "testnet",
			mina: "https://gateway.mina.devnet.zeko.io",
			archive: "https://gateway.mina.archive.devnet.zeko.io"
		})
	)

	// Send request to prove transfer
	const response = await fetch(sequencerUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query: `
        mutation ($transferInput: TransferInput!) {
          proveTransferRequest(input: $transferInput) {
            accountUpdateKey
          }
        }
      `,
			variables: {
				transferInput: {
					transfer: {
						recipient: sender.toPublicKey().toBase58(),
						amount: amount
					},
					direction: "DEPOSIT"
				}
			}
		})
	})

	// @ts-ignore
	const key = (await response.json())?.data?.proveTransferRequest
		?.accountUpdateKey

	// Poll for proved account update
	let transferCallForest: string | null = null
	while (true) {
		console.log("Polling for transferJson")
		const response = await fetch(sequencerUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				query: `
          query ($key: String!) {
            transferAccountUpdate(key: $key)
          }
        `,
				variables: { key }
			})
		})

		// @ts-ignore
		transferCallForest = (await response.json())?.data?.transferAccountUpdate

		if (transferCallForest !== null) {
			console.log("Proving succesful")
			break
		} else {
			await new Promise((resolve) => setTimeout(resolve, 3_000))
		}
	}

	// Create zkapp command
	let txn = await Mina.transaction(
		{
			sender: sender.toPublicKey(),
			fee: 1e9
		},
		async () => {
			const fundsUpdate = AccountUpdate.createSigned(sender.toPublicKey())
			fundsUpdate.balance.subInPlace(amount)
		}
	)

	// Append proved account update to the command
	JSON.parse(transferCallForest).forEach((accountUpdate: any) => {
		txn.transaction.accountUpdates.push(AccountUpdate.fromJSON(accountUpdate))
	})

	await txn.sign([sender]).send()
}

main().catch(console.error)
```

and this is the code for deposit claim:

```ts
const sequencerUrl = "https://devnet.zeko.io/graphql";
const l1NodeUrl = "https://gateway.mina.devnet.zeko.io";
const l1ArchiveUrl = "https://gateway.mina.archive.devnet.zeko.io";

const outerAccountPk = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF");
const innerAccountPk = PublicKey.fromBase58("B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1");

const setL1 = () => {
  Mina.setActiveInstance(
    Mina.Network({
      networkId: "testnet",
      mina: l1NodeUrl,
      archive: l1ArchiveUrl,
    })
  );
};

const setL2 = () => {
  Mina.setActiveInstance(
    Mina.Network({
      networkId: "testnet",
      mina: sequencerUrl,
      archive: sequencerUrl,
    })
  );
};

const actionsToTransfer = (
  actions: {
    actions: string[][];
    hash: string;
  }[]
) => {
  return actions.flat().map(({ actions, hash }) => {
    const [amount, x, yParity] = actions[0];
    return {
      amount,
      pk: PublicKey.from({ x: Field.from(x), isOdd: yParity === "1" }),
      actionState: Field.from(hash),
      json: actions,
    };
  });
};

const findTransfer = async (pk: PublicKey, amount: number) => {
  const result = await Mina.fetchActions(outerAccountPk);

  // @ts-ignore
  if (result.error !== undefined) {
    // @ts-ignore
    throw new Error(result.error);
  }

  const actions = result as {
    actions: string[][];
    hash: string;
  }[];

  const transfer = actionsToTransfer(actions.reverse()).find(
    (action) => action.  === amount.toString() && action.pk.equals(pk)
  );

  if (transfer === undefined) {
    throw new Error("No matching transfer found");
  }

  return transfer;
};

const fetchTransfersExtension = async (actionState: Field) => {
  const result = await Mina.fetchActions(outerAccountPk, { fromActionState: actionState });

  // @ts-ignore
  if (result.error !== undefined) {
    // @ts-ignore
    throw new Error(result.error);
  }

  return actionsToTransfer(result as { actions: string[][]; hash: string }[]);
};

const main = async () => {
  setL1();

  // Find my transfer
  const transfer = await findTransfer(sender.toPublicKey(), amount);
  console.log("transfer", transfer);

  // Fetch all transfers after mine
  const afterAll = await fetchTransfersExtension(transfer.actionState);
  console.log(
    "afterAll",
    afterAll.map(({ amount, pk, actionState }) => ({ amount, pk: pk.toBase58(), actionState: actionState.toString() }))
  );

  setL2();

  // Fetch synced deposit
  const { account: innerAccount } = await fetchAccount({ publicKey: innerAccountPk });
  const syncedDepositsState = innerAccount?.zkapp?.appState.at(0)!;
  console.log(syncedDepositsState.toString());

  // Filter out the not yet synced deposits
  const i = afterAll.findIndex(({ actionState }) => actionState.equals(syncedDepositsState));
  const after = afterAll.slice(0, i + 1);

  // Sanity check
  const expectedDepositsState = after.reduce(
    (acc, { json }) => AccountUpdate.Actions.updateSequenceState(acc, AccountUpdate.Actions.fromJSON(json).hash),
    transfer.actionState
  );
  console.log(expectedDepositsState.toString());
  assert(expectedDepositsState.equals(syncedDepositsState), "Deposits state mismatch");

  // Send request to prove transfer
  const response = await fetch(sequencerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        mutation ($transferInput: TransferInput!) {
          proveTransferClaim(input: $transferInput) {
            accountUpdateKey
          }
        }
      `,
      variables: {
        transferInput: {
          isNew: true,
          before: [],
          pointer: Reducer.initialActionState.toString(),
          after: after.map(({ amount, pk }) => ({
            recipient: pk.toBase58(),
            amount,
          })),
          transfer: {
            transfer: {
              recipient: sender.toPublicKey().toBase58(),
              amount: amount,
            },
            direction: "DEPOSIT",
          },
        },
      },
    }),
  });

  // @ts-ignore
  const key = (await response.json())?.data?.proveTransferClaim?.accountUpdateKey;

  // Poll for proved account update
  let transferCallForest: string | null = null;
  while (true) {
    console.log("Polling for transferJson");
    const response = await fetch(sequencerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($key: String!) {
            transferAccountUpdate(key: $key)
          }
        `,
        variables: { key },
      }),
    });

    // @ts-ignore
    transferCallForest = (await response.json())?.data?.transferAccountUpdate;

    if (transferCallForest !== null) {
      console.log("Proving succesful");
      break;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }

  // Create zkapp command
  let txn = await Mina.transaction(
    {
      sender: sender.toPublicKey(),
      fee: 1e9,
    },
    async () => {}
  );

  // Append proved account update to the command
  JSON.parse(transferCallForest).forEach((accountUpdate: any) => {
    txn.transaction.accountUpdates.push(AccountUpdate.fromJSON(accountUpdate));
  });

  txn.transaction.accountUpdates = txn.transaction.accountUpdates.map((update) => {
    if (update.body.authorizationKind.isSigned.toBoolean()) {
      update.lazyAuthorization = {
        kind: "lazy-signature",
      };
      return update;
    } else {
      return update;
    }
  });

  const signed = txn.sign([sender]);

  console.log(signed.toPretty());

  await signed.send();
};

main().catch(console.error);
```
