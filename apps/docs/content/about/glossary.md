# Glossary

## Account

A Zeko L2 account is identified by a public key and token ID. Its public key uses the `B62...` format. Ethereum accounts use `0x...` addresses. On the Ethereum-backed Zeko deployment the native balance is ETH; custom tokens have separate token accounts.

## Account Update

An instruction to change one Zeko account, subject to preconditions and authorization. A zkApp transaction contains one or more `AccountUpdate` values. This is part of the Mina-derived execution model retained by Zeko.

## Actions

Append-only messages authenticated by an action-state commitment. Ethereum deposits become Zeko outer actions through a bridge proof; L2 withdrawal actions become settlement-bound claim commitments. See [Core Concepts](../architecture/zeko-core-concepts.md#actions-and-cross-layer-state).

## Asset Registry

The authenticated mapping between an Ethereum ERC-20 and its Zeko token identity, precision, and bridge configuration. A matching token symbol alone does not establish this mapping.

## Blockchain

A sequence of cryptographically linked blocks whose accepted state is determined by consensus rules.

## Consensus Mechanism

Rules by which a network agrees on its accepted chain and state. Ethereum uses proof of stake.

## Cryptography

Mathematical techniques used for signatures, commitments, hashes, and proofs that protect and authenticate protocol data.

## Custom Tokens

Tokens represented by separate token accounts on Zeko. o1js provides `TokenContract` for implementing token permissions and operations. Only registered mappings are supported for ERC-20 bridging.

## Data Availability (DA) Layer

Storage and retrieval of the data needed to reconstruct rollup state. The current Ethereum testnet uses a 2-of-3 DA committee. Complete Ethereum blob publication and blob-to-batch-root binding remain future work.

## Decentralisation

Distribution of operation and control among independent participants. Zeko's current Ethereum integration retains permissioned operational and administrative roles.

## ETH

Ether, the native asset of Ethereum and the Ethereum-backed Zeko deployment. ETH has 18 decimals on Ethereum and 9 on Zeko; software must convert units at the bridge boundary.

## Finality

The point at which a chain treats an accepted block as finalized under its consensus rules. L2 inclusion is distinct from Ethereum settlement and Ethereum finality.

## Layer 1 (L1)

The base chain where a rollup settles. For the current Zeko architecture, this is Ethereum.

## Layer 2 (L2)

The execution layer that batches transactions and settles results on L1. Zeko's L2 uses a zkApp ledger and recursive proofs.

## Merkle Tree

A commitment structure that permits efficient inclusion proofs. Ethereum withdrawal claims use a Merkle path under a settlement-bound claim root.

## Mina Protocol

The source ecosystem for Zeko's inherited ledger, zkApp, address, and Pickles/Kimchi proof foundations. It is the settlement chain of legacy Zeko deployments, not the Ethereum-backed deployment. See [Proof-System Heritage](../background/mina-protocol.md).

## Permissions

Account rules specifying which changes require a signature, proof, or other permitted authorization. zkApp account updates must satisfy these rules and their preconditions.

## Proof of Stake (PoS)

A consensus mechanism using staked assets and validator participation to secure a chain. Ethereum uses proof of stake.

## Proof of Work (PoW)

A consensus mechanism in which miners perform computational work to propose blocks. Bitcoin uses proof of work.

## Prover / Verifier

A prover constructs evidence for a statement; a verifier checks it. Zeko proof workers establish valid L2 transitions, and the SP1 settlement program verifies the exported proof for Ethereum.

## Recursion

Verification of one proof inside another. Zeko uses Pickles recursion to aggregate transaction and rollup proofs.

## Reducer

An o1js construct for dispatching and processing actions in a zkApp. Actions and their commitments let contracts authenticate ordered messages.

## Sequencer

The service that orders transactions, applies them to the Zeko ledger, writes DA data, schedules proofs, and prepares commits for settlement.

## Settlement

Acceptance of a proof-bound Zeko state transition by the Ethereum settlement contract. A submitted settlement transaction is not yet a finalized Ethereum checkpoint.

## Smart Contract

Code defining authorized changes to blockchain state. Zeko applications use zkApps; Ethereum settlement and custody use Solidity contracts.

## SP1

The zkVM used by the Ethereum integration to verify Zeko proofs and produce proof-backed settlement and bridge receipts that Ethereum contracts can verify.

## Token Account

A balance and associated state for a public key under a particular token ID. See [Account](#account).

## Token ID

An identifier for a Zeko token. It is distinct from an Ethereum ERC-20 contract address and must be resolved through the registry when bridging.

## Token Manager Account

See [Custom Tokens](#custom-tokens).

## Token Owner

The zkApp account that defines authorization for a custom token, including minting, burning, and approving transfers.

## TokenContract Class

The o1js base class for implementing custom token contracts on the zkApp execution layer.

## Transaction Snark

A proof of a ledger state transition. Recursive aggregation combines these proofs into a proof for a batch of transactions.

## Zero-Knowledge Proof (ZKP)

A proof that establishes a statement without revealing its private witness. Public outputs and published transaction data remain visible.

## Zeko

An Ethereum rollup for zero-knowledge applications. It retains the Mina-derived zkApp execution model and settles proof-bound state through SP1 and Ethereum contracts.

## Zeko Snap

The MetaMask Snap that provides a Zeko L2 account and approves Zeko signatures. It complements the Ethereum account in MetaMask. Local Snap development uses MetaMask Flask; availability in ordinary MetaMask depends on release and allowlisting status.

## zkApp

A zero-knowledge application using provable methods and account updates. Zeko zkApps are written with o1js; developers choose which inputs stay private and which state is public.

## ZkProgram

An o1js construct for provable off-chain computation, including recursive programs whose proofs can be verified by a zkApp.

## zk-Rollup

A Layer 2 design that batches transactions and proves their validity to a settlement chain. Proof validity, data availability, finality, and administrative control are separate parts of the security model.
