# Zero-Knowledge Proofs (ZKPs)

Zero-Knowledge Proofs (ZKPs) are a fundamental cryptographic concept with significant implications for blockchain technology, privacy, and scalability. They form a core part of the technology behind Mina Protocol and Layer 2 solutions built on it, such as Zeko.

## High-Level Explanation: Proving Without Revealing

Simply put, a **Zero-Knowledge Proof** allows one party, known as the **prover**, to prove to another party, the **verifier**, that a statement is true **without revealing any information about the statement itself**, beyond the fact that it is true.

Think of proving you know a secret password to enter a room. With a ZKP, you can convince someone that you know the password and are therefore authorised to enter, without ever actually telling them the password itself. The verifier is convinced you possess the knowledge, but they gain no additional information about the secret.

Key properties of a ZKP system include:

- **Completeness:** If the statement is true, an honest prover can always convince an honest verifier.
- **Soundness:** If the statement is false, a dishonest prover cannot convince an honest verifier, except with a negligible probability.
- **Zero-Knowledge:** If the statement is true, the verifier learns nothing beyond the truth of the statement itself.

## Why are ZKPs Important for Scalability and Privacy?

ZKPs address key challenges in blockchain networks: limited **scalability** and the need for greater **privacy**.

### Enhancing Privacy

Blockchains are often public ledgers where all transactions are transparent. ZKPs enable **privacy-preserving transactions** by allowing parties to prove the validity of a transaction (e.g., that they have sufficient funds and the recipient is valid) without revealing sensitive details like the exact amount transferred or the identities of the participants. This opens up possibilities for more confidential digital interactions and applications on-chain.

### Improving Scalability

One of the most impactful applications of ZKPs for scalability is in **zk-rollups**, a type of Layer 2 scaling solution. Zk-rollups process transactions off-chain, bundling (or "rolling up") hundreds or thousands of transactions into a single batch. A single ZKP is then generated to cryptographically prove the correctness of _all_ transactions within that batch. This single proof is submitted to the Layer 1 blockchain, dramatically reducing the data that needs to be stored and verified on-chain. This results in significantly increased transaction throughput and lower transaction costs.

## ZKPs in Mina Protocol and Zeko

Mina Protocol uniquely integrates ZKPs at its core through recursive proofs. This recursion allows proofs to verify other proofs, enabling Mina to compress its entire blockchain history into a constant-sized proof. Furthermore, Mina uses recursive tree-based proofs to aggregate and compress proofs for individual transactions within blocks. This inherent ZKP-based compression is a foundational element that Zeko leverages. In Zeko, transaction validity is proven using ZKPs, and these proofs are aggregated into larger proofs representing batches of transactions.

In summary, ZKPs are crucial for building more private and scalable blockchain applications by allowing information to be verified without being exposed, and by enabling the efficient compression and verification of large numbers of transactions off-chain before settling them on Layer 1. Mina and Zeko utilise these properties extensively for transaction processing and state transitions.
