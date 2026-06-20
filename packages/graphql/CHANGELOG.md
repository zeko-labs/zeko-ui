# @zeko-labs/graphql

## 0.3.4

### Patch Changes

- 8fd778a: Validate deposit and withdrawal amounts against both bridge proof fees and every missing destination account creation fee.
- e4fefec: Use the canonical empty actions-list state for missing bridge action before-state values and align default V2 action start indices with one-based bridge histories.

## 0.3.3

### Patch Changes

- 9323728: Add `chainStatus` to the mina-archive `fetchActions` query `blockInfo` selection. This lets consumers distinguish canonical/pending live-chain blocks from orphaned dead-fork blocks that the archive can return when its database holds more than one chain instance. The field is additive and does not change existing consumers.
- da52e7a: Filter Actions API bridge status queries to canonical rows and expose finality metadata. Withdrawal status matching now uses transaction hash plus aux after aux candidate lookup, preventing repeated same-recipient/same-amount withdrawals from being marked completed by an older witness.

## 0.3.2

## 0.3.1

## 0.3.0

## 0.2.1

## 0.2.0

### Minor Changes

- 39948b6: Update bridge operation methods to require a transaction signing callback.

  This is a breaking API change for SDK consumers: deposit, withdrawal, finalization, and cancellation methods now request wallet signatures through an explicit callback while preparing bridge proofs and executable transactions.

  The Zeko GraphQL package now exposes the updated bridge schema, bridge fee fields, proving result query, and signed transferrer inputs used by deposit and withdrawal requests.

## 0.1.0

## 0.0.1

### Patch Changes

- 1045f68: Release the public `@zeko-labs/graphql` and `@zeko-labs/bridge-sdk` packages with the updated package naming, publish workflow wiring, and standalone package documentation.
