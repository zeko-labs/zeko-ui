# Architecture and Protocol

Use this file only when the user needs conceptual or protocol-level understanding. This is not the default starting point for end users.

## High-level model

- Zeko is a Mina-oriented zkRollup with an L2 execution layer plus L1 synchronization.
- The sequencer is the state-transition coordinator: it accepts L2 transactions, applies them, batches them, and commits resulting state to L1.
- The DA layer is a committee that stores batch data and signs only when it can reconstruct the target ledger transition from the provided data.

## Concepts that matter most

- `Commit` is the main L1 synchronization primitive between the L2 state and L1-visible state.
- The rollup design distinguishes inner action state and outer action state, which matters for bridge proofs and synchronization.
- Bridge operations are witness-based: deposits and withdrawals become provable bridge actions that later authorize minting or release on the other side.
- Multiple L1 holder accounts are used to reduce blast radius for bridge-held funds.

## Safe summary for user-facing answers

- Deposits start on Mina and are later finalized on Zeko once the deposit witness is accepted and provable.
- Withdrawals start on Zeko and are later finalized on Mina after the required proof and delay window.
- DA signatures are availability attestations for specific ledger transitions, not just generic metadata votes.

## Authority and caution

- If `/Users/hebilicious/GitHub/zeko` exists locally, use it as the deep protocol source.
- Prefer `rollup-centralized-spec.md` over older design docs.
- Treat `bridge-spec.md` as conceptual architecture unless current runtime behavior is corroborated elsewhere.

## Use these source areas

- `../zeko/src/app/zeko/sequencer/README.md`
- `../zeko/src/app/zeko/da_layer/README.md`
- `../zeko/src/app/zeko/circuits/design/rollup-centralized-spec.md`
- `../zeko/src/app/zeko/circuits/design/bridge-spec.md`
- `../zeko/src/app/zeko/zeko_circuits_config/zeko_circuits_config.ml`
