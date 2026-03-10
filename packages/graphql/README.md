# Zeko GraphQL

> **Public mirror** — This package is automatically synced from the private `zeko-ui` monorepo. Development happens in the monorepo; this package mirror is the public source of truth for releases.

Shared GraphQL documents and generated TypeScript types used by the public Zeko SDKs and internal Zeko services.

## Installation

```bash
npm install @zeko-labs/graphql
```

## Usage

Import the generated document nodes from the entrypoint that matches the target service.

```typescript
import { accountQuery } from "@zeko-labs/graphql/mina"
import { fetchConfigQuery } from "@zeko-labs/graphql/zeko"
```

## Development

These commands are maintainer workflows and only run from the private zeko-ui monorepo.

These commands are maintainer workflows and only run from the private zeko-ui monorepo.

These commands are maintainer workflows and only run from the private zeko-ui monorepo.

Run all commands from the monorepo root with Moon:

```bash
moon run graphql:build
moon run graphql:typecheck
```

These schema refresh tasks are maintainer workflows, and some of them depend on internal monorepo schemas.

These schema refresh tasks are maintainer workflows, and some of them depend on internal monorepo schemas.

These schema refresh tasks are maintainer workflows, and some of them depend on internal monorepo schemas.

Use the schema refresh tasks when GraphQL schemas change:

```bash
moon run graphql:schema-get
```
