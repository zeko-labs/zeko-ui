# Leaderboard Indexer

A background indexing service that monitors the Zeko blockchain, extracts on-chain user actions, calculates leaderboard points, and maintains a real-time leaderboard in PostgreSQL. The service runs periodically alongside an HTTP control server with authentication-protected endpoints.

## Architecture

The indexer is a standalone service that integrates with the leaderboard ecosystem:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Zeko      │ ◄───────┤   Indexer    │────────►│  PostgreSQL  │
│  Blockchain  │  fetch  │   Service    │  write  │   Database   │
└──────────────┘         └──────────────┘         └──────────────┘
                                │                         │
                                │ trigger broadcast       │ read
                                ▼                         ▼
                         ┌──────────────┐         ┌──────────────┐
                         │      API     │◄────────┤  Leaderboard │
                         │   Service    │         │     Table    │
                         └──────────────┘         └──────────────┘
                                │
                                │ WebSocket
                                ▼
                         ┌──────────────┐
                         │    Users     │
                         └──────────────┘
```

### Components

- **Control Server**: HTTP server with authentication-protected endpoints for starting, stopping, and monitoring the indexer
- **Indexer Loop**: Periodic background process that fetches blockchain events at configurable intervals
- **Database Client**: Direct PostgreSQL connection for writing actions and updating leaderboard scores
- **API Client**: HTTP client to trigger broadcast updates to the leaderboard API service

### Data Flow

1. **Fetch**: Query Zeko blockchain for events (deposits, swaps, liquidity actions, etc.)
2. **Process**: Transform blockchain events into action records with point values
3. **Store**: Insert actions into PostgreSQL (duplicate-safe)
4. **Calculate**: Update leaderboard scores for affected wallets
5. **Broadcast**: Notify API service to distribute updates to connected clients

The indexer maintains its position with `lastFetchedBlock` and handles large block ranges through automatic pagination. Error handling includes exponential backoff and configurable retry logic.

## Tech Stack

- **Runtime**: Bun
- **Database**: PostgreSQL with Drizzle ORM
- **HTTP Server**: Node.js built-in `http` module
- **Blockchain Query**: GraphQL client for Zeko Archive Node
- **Task Runner**: Moon (monorepo orchestration)

## Quick Start

```bash
# Install dependencies from monorepo root
pnpm install

# Start the service (runs on port 3001)
moon run lb-indexer:dev
```

The service exposes HTTP endpoints for control and monitoring. Authentication is required for all operations.

## Scoring System

The indexer tracks various on-chain actions and assigns points based on activity type:

| Action Type | Points | Max Occurrences | Description            |
| ----------- | ------ | --------------- | ---------------------- |
| Deposit     | 20     | 1               | Bridge MINA to Zeko    |
| Withdrawal  | 20     | 1               | Bridge Zeko to MINA    |
| Faucet      | 10     | 1               | Claim from faucet      |
| Liquidity   | 10     | 5               | Add liquidity to pools |
| Swap        | 5      | 20              | Swap tokens            |

## Configuration

Environment variables:

- `DATABASE_URL`: PostgreSQL connection string (shared with API service)
- `PORT`: HTTP server port (default: `3001`)
- `API_URL`: Leaderboard API service URL for triggering broadcasts
- `AUTH_TOKEN`: Authentication token for protected endpoints

## Development

```bash
# Run tests
moon run lb-indexer:test

# Development mode with auto-restart
moon run lb-indexer:dev
```
