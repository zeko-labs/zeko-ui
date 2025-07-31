import { PublicKey } from "o1js";
import { Bridge } from "..";

async function main() {
  const bridge = await Bridge.init({
    l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
    l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
    zekoUrl: "http://localhost:3000/graphql",
    l1Network: "testnet",
    l2Network: "testnet",
  });

  const actions = await bridge.fetchOuterActions(bridge.outerPk);
  console.log(
    actions.map(
      ({ action: { action, beforeActionState, afterActionState }, type }) => ({
        type,
        action: action.map(x => x.toString()),
        beforeActionState: beforeActionState.toString(),
        afterActionState: afterActionState.toString(),
      })
    )
  );

  const recipient = PublicKey.fromBase58(
    "B62qrPQ5HPV3fnxmiqEeqWrw7f716hcr7hKp4RjQxp9aJLqA9Z7brRs"
  );
  const deposits = await bridge.findDeposits(recipient);
  console.log(
    deposits.map(
      ({
        recipient,
        amount,
        timeout,
        holderAccountL1,
        outerPk,
        beforeActionState,
        afterActionState,
        timedOut,
      }) => ({
        recipient: recipient.toBase58(),
        amount: amount.toString(),
        timeout: timeout.toString(),
        holderAccountL1: holderAccountL1.toBase58(),
        outerPk: outerPk.toBase58(),
        beforeActionState: beforeActionState.toString(),
        afterActionState: afterActionState.toString(),
        timedOut,
      })
    )
  );
}

main().catch(console.error);
