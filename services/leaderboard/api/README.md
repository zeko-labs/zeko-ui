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

#### Details

Real-Time Notification System Architecture
This document details the architecture for a scalable real-time notification system using Cloudflare Workers and Durable Objects. The system is designed to handle a large number of concurrent users receiving updates via GraphQL subscriptions.

Core Components
The system is composed of four distinct services:

API Service:

Technology: Cloudflare Worker running a GraphQL server with graphql-sse.

Responsibility: Acts as the public-facing entry point for clients. It manages the long-lived HTTP connections for GraphQL subscriptions. For each subscription, it establishes and maintains a WebSocket connection with the corresponding UserDO.

UserDO (User Durable Object):

Instances: One unique UserDO is instantiated per connected user.

Responsibility: This is the stateful representation of a user.

It holds the server-side end of the WebSocket connection initiated by the API Service.

Upon creation, it calculates which DistributorDO shard it belongs to using a consistent hashing algorithm (e.g., hash(userId) % 100).

It subscribes to its assigned DistributorDO to receive broadcasted messages.

When it receives a message from a DistributorDO via RPC, it forwards that payload through its WebSocket to the API Service.

DistributorDO (Distributor Durable Object):

Instances: A fixed pool of 100 shards (e.g., distributor-0 through distributor-99).

Responsibility: Manages the fan-out to a subset of users.

Maintains an in-memory list of all UserDOs that have subscribed to it.

When it receives a broadcast request from the Indexing Service, it loops through its list and makes a parallel RPC call to each UserDO.

Indexing Service:

Technology: A stateless Cloudflare Worker.

Responsibility: Initiates the system-wide broadcast.

Receives a trigger from an external source (e.g., a webhook or message queue).

It iterates from 0 to 99, gets the stub for each DistributorDO, and fires off 100 parallel requests to them. This is a non-blocking operation.

System Flows

1. User Connection Flow
   A client initiates a GraphQL subscription request to the API Service.

The API Service authenticates the user and gets the stub for their specific UserDO.

The API Service initiates a WebSocket connection upgrade request to the UserDO.

The UserDO accepts the connection, holding it open for future messages.

The UserDO calculates its shard ID (e.g., shard_id = hash(userId) % 100).

The UserDO makes an RPC call to the corresponding DistributorDO (e.g., distributor-42) to register itself as a subscriber.

2. Broadcast Fan-Out Flow
   An external event triggers the Indexing Service with a payload to broadcast.

The Indexing Service creates an array of 100 promises, one for each DistributorDO shard.

It executes all promises in parallel using Promise.all(), sending the payload to every DistributorDO simultaneously.

Each of the 100 DistributorDOs receives the payload at the same time.

Each DistributorDO iterates through its internal list of UserDO subscribers and sends them the payload via parallel RPC calls.

Each UserDO receives the payload and writes it to its open WebSocket connection.

The API Service receives the message from the WebSocket and pushes it to the end client via the graphql-sse stream.

This architecture avoids a central bottleneck by distributing both the connection management (UserDO) and the broadcast load (DistributorDO shards), enabling the system to scale horizontally.

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
