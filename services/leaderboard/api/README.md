# Leaderboard API

A high-performance leaderboard service built on Cloudflare Workers with GraphQL API and real-time WebSocket updates.

## Architecture

### GraphQL API

The service exposes a single `leaderboard` query that supports:

- **Pagination**: Efficient keyset pagination with O(1) performance at any page depth
- **Wallet Search**: Find a specific wallet's ranking and surrounding entries
- **Rankings**: Accurate ranks calculated using window functions

Each query returns entries with rank, wallet address, score, plus pagination metadata (`hasMore`, `total`).

### Real-time WebSocket Updates

A distributed pub/sub system using Cloudflare Durable Objects:

- **UserDO**: Manages individual WebSocket connections and subscribes to a distributor shard based on consistent hashing (0-99)
- **DistributorDO**: 100 fixed shards that broadcast leaderboard updates to subscribed users in parallel

Users connect via WebSocket, are assigned to a shard, and receive real-time leaderboard updates. The system automatically handles connection failures and supports anonymous users.

### Data Layer

The leaderboard queries a pre-computed table storing wallet addresses and aggregated scores. Score calculations are handled by a separate indexer service that monitors blockchain activity and updates the table. This separation enables fast queries (sub-10ms) while keeping business logic independent from the API.

## Development

```bash
# Run tests (33 tests covering GraphQL, DOs, and WebSocket)
moon run lb-api:test

# Type check
moon run lb-api:type-cf

# Deploy
wrangler deploy
```

## Environment

- `DATABASE_URL`: PostgreSQL connection string
- Durable Object bindings: `USER_DO`, `DISTRIBUTOR_DO`
