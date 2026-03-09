# Bridge CLI

Agent-first CLI for bridging assets between Mina and Zeko.

The package is maintained in the private Zeko monorepo and mirrored to [zeko-labs/bridge-cli](https://github.com/zeko-labs/bridge-cli) for public source, issues, and releases.

## Install

```sh
npm install -g @zeko-labs/bridge-cli
```

Run it directly with:

```sh
zeko-bridge --help
```

The npm release is a single built JavaScript tarball. There are no platform-specific subpackages.

## Development

Development happens from the monorepo root with `moon`:

```sh
moon run bridge-cli:build
moon run bridge-cli:typecheck
moon run bridge-cli:test
```

Release and public mirror details live in [RELEASE.md](./RELEASE.md).
