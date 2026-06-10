# @zeko-labs/graphql

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
