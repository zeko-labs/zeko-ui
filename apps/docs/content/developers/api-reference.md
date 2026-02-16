# API Reference

Find API documentation for Zeko SDKs, smart contracts, and developer tools here.

## Available APIs & SDKs

### Zeko Bridge SDK

The Zeko Bridge SDK enables seamless interaction with the Zeko Bridge for cross-chain operations between Mina L1 and Zeko L2.

- **Package**: `@zeko/bridge-sdk`
- **Installation**: `npm install @zeko/bridge-sdk` or `pnpm add @zeko/bridge-sdk`
- **Repository**: [zeko-labs/zeko-ui (packages/bridge-sdk)](https://github.com/zeko-labs/zeko-ui/tree/main/packages/bridge-sdk)

**Example Usage**:
```typescript
import { BridgeSDK } from '@zeko/bridge-sdk'

// Example function demonstrating SDK usage
async function bridgeTokens() {
  // Initialize the SDK
  const bridge = new BridgeSDK({
    network: 'testnet'
  })

  // Bridge tokens from L1 to L2
  await bridge.deposit({
    amount: '100',
    recipient: 'B62...' // Replace with actual Mina public key
  })
}

// Call the function in your application
bridgeTokens().catch(console.error)
```

### Lumina SDK

The Lumina SDK provides tools for interacting with the LuminaDex protocol on Zeko.

- **Documentation**: [sdk.luminadex.com](https://sdk.luminadex.com/)
- **Contracts**: [github.com/Lumina-DEX/lumina](https://github.com/Lumina-DEX/lumina/tree/main/packages/contracts)

### GraphQL Endpoints

Zeko provides GraphQL endpoints for querying blockchain data:

- **Testnet GraphQL**: `https://graphql.zeko.io/testnet`
- **API Documentation**: Query accounts, transactions, blocks, and zkApp state

**Example Query**:
```graphql
query GetAccount {
  # Replace B62... with an actual Mina public key address
  account(publicKey: "B62...") {
    balance {
      total
    }
    nonce
  }
}
```

### o1js Framework

o1js is the core TypeScript framework for writing zkApps and zkPrograms on Mina and Zeko.

- **Package**: `o1js`
- **Installation**: `npm install o1js`
- **Documentation**: [docs.minaprotocol.com/zkapps/o1js](https://docs.minaprotocol.com/zkapps/o1js)
- **Repository**: [github.com/o1-labs/o1js](https://github.com/o1-labs/o1js)

## Additional Resources

For more detailed examples and tutorials, visit:
- [Examples & Boilerplates](./examples-boilerplates.md)
- [Guides & Tutorials](./guides-tutorials.md)
- [Getting Started](./getting-started.md)
