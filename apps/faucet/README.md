# Faucet

The Faucet is an API built with cloudflare worker that uses cloudflare container. It's being used by the zeko-ui.
It uses cloudflare KV to prevent double-claim off-chain.

The CI is entirely managed by Cloudflare and GitHub.
Open PR to deploy a preview, and merge to main to deploy to production.

The faucet is currently deployed at [faucet.api.zeko.io](https://faucet.api.zeko.io).
