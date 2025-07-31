import { PrivateKey, PublicKey, UInt32, UInt64 } from "o1js";
import { env } from "process";
import { Bridge } from "..";

if (!env.MINA_PRIVATE_KEY) {
  throw new Error("MINA_PRIVATE_KEY is not set");
}

const signer = PrivateKey.fromBase58(env.MINA_PRIVATE_KEY);

async function main() {
  const bridge = await Bridge.init({
    l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
    l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
    zekoUrl: "http://localhost:3000/graphql",
    l1Network: "testnet",
    l2Network: "testnet",
  });

  const depositParams = {
    recipient: PublicKey.fromBase58(
      "B62qrPQ5HPV3fnxmiqEeqWrw7f716hcr7hKp4RjQxp9aJLqA9Z7brRs"
    ),
    amount: UInt64.from(10 * 10e8),
    timeout: UInt32.MAXINT(),
    holderAccountL1: bridge.outerHolders[0],
  };

  const txn = await bridge.submitDeposit(
    { sender: depositParams.recipient, fee: 0.1 * 10e8 },
    depositParams
  );

  console.log(txn.toPretty());

  const result = await txn.sign([signer]).send();

  console.log(result.hash);
}

main().catch(console.error);
