# Faucet Container

This subdirectory contains the source code for the Zeko Faucet. It includes :

- **index.ts**: The main entry point for the faucet application, which sets up the Hono server and handles requests.
- **faucet.ts**: Contains the logic for sending payments from the faucet. This uses a direct Mina transaction.
- **zkapp.ts**: Contains the logic for sending payments using a ZKApp. This is currently not used in the main application but is still working.
- **scripts/cli.ts**: A POC for a CLI to interact with the faucet when deployed on Mina/Zeko. It hasn't been tested yet.

Run the tests to ensure both the zkapp and the direct Mina transaction are working correctly.

```sh
bun run test
```
