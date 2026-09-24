# Zeko Documentation

The public VitePress site documents Zeko's Ethereum rollup: zkApp execution with o1js, ETH and registered ERC-20 bridging, the Zeko Snap, Ethereum settlement, and operator responsibilities.

Current content lives in `content/`; navigation and site metadata live in `.vitepress/config.ts`. Legacy Mina-backed tutorials retain their URLs and executable examples but are clearly labeled and grouped separately in navigation.

Run repository workflows from the monorepo root:

```sh
moon run docs:dev
moon run docs:test
moon run docs:build
```

The build also includes the Bridge SDK, Bridge CLI, and Faucet CLI package READMEs. Preserve their deployment scope when updating shared references. `CI=1 moon run docs:test` additionally checks external Markdown links; the standard build checks internal page links.

The historical [outline](./PLAN.md) describes the earlier Mina-backed documentation plan. It is not the source of truth for current product positioning.
