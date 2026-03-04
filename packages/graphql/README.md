# Zeko GraphQL

> **Public mirror** — This package is automatically synced from the private `zeko-ui` monorepo. Development happens in the monorepo; this package mirror is the public source of truth for releases.

Shared GraphQL documents and generated TypeScript types used by the public Zeko SDKs and internal Zeko services.

## Installation

```bash
npm install @zeko/graphql
```

## Usage

Import the generated document nodes from the entrypoint that matches the target service.

```typescript
import { accountQuery } from "@zeko/graphql/mina"
import { fetchConfigQuery } from "@zeko/graphql/zeko"
```

## Development

Run all commands from the monorepo root with Moon:

```bash
moon graphql:build
moon graphql:typecheck
```

Use the schema refresh tasks when GraphQL schemas change:

```bash
moon graphql:schema-get
```
