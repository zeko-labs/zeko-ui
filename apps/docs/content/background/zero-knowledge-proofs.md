# Zero-Knowledge Proofs

A zero-knowledge proof lets a prover establish a statement without revealing its private witness. For example, an application can prove that a user meets a condition without publishing the underlying personal data.

A proof system aims to provide completeness, so valid statements can be proved; soundness, so invalid statements cannot be accepted; and zero knowledge, so verification does not disclose the private witness.

## Validity and recursion

Validity proofs establish that a computation follows its rules. Recursive proofs can verify earlier proofs, allowing a system to aggregate verification of many state transitions.

Zeko uses the Mina-derived Pickles and Kimchi proof systems for its transaction and rollup proofs. Its SP1 settlement program verifies the exported Zeko proof and derives the result that Ethereum contracts accept.

The [proof-systems book](https://o1-labs.github.io/proof-systems/) explains the underlying cryptography. [Zeko Core Concepts](../architecture/zeko-core-concepts.md#the-role-of-zero-knowledge-proofs-in-zeko) explains its role in the rollup.

## Privacy is an application property

Proofs can hide private inputs, but public outputs, account updates, balances, and bridge transfers remain observable. Applications must decide what belongs in the private witness and avoid publishing it elsewhere.

## What a proof does not establish

A valid state proof does not by itself establish data availability, Ethereum finality, or the absence of administrative upgrade powers. Those are separate parts of the [security model](../architecture/security-model.md).
