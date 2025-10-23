# Real-Time Leaderboard: Architecture Overview

## 1. Introduction

This document outlines the high-level architecture for a real-time leaderboard for the Zeko (Mina L2) contest. The primary goal is to create a flexible, scalable, and maintainable system that can track on-chain user actions, display a live ranking, and adapt to changing business rules.

The architecture is a **decoupled, custom stack** built on Cloudflare Workers and PostgreSQL (Supabase), centered around an **Event Sourcing** pattern. This approach prioritizes a clean separation of concerns, ensuring that the recording of raw data (indexing) is distinct from the API layer that serves leaderboard data and real-time updates.

## 2. Core Principles

- **Event Sourcing as the Source of Truth:** We store an immutable log of all actions (`actions` table). The leaderboard is a projection of this log, pre-computed and stored in the `leaderboard` table. This provides a full audit trail and allows business rules to be changed without data migration by recalculating from the action log.
- **Separation of Concerns:** The **Indexer** is a background service responsible for monitoring the blockchain and updating the database. The **API Layer** is responsible for serving leaderboard data and real-time updates to clients.
- **Flexibility Over Premature Optimization:** The design handles changes to business logic gracefully through recalculation endpoints that can rebuild the leaderboard from the action log.

## 3. Component Breakdown

### 3.1. Database

- **Technology:** **PostgreSQL** (can be hosted on Supabase or similar) with **Drizzle ORM**.
- **Role:** Acts as the single, durable source of truth for the entire system.
- **Schema Pattern:** The database stores the immutable event log plus a pre-computed leaderboard table. Drizzle is used to define the schema in TypeScript, providing type safety and easy migrations.
  - `actions`: A log of all relevant on-chain actions performed by users (e.g., `FAUCET_ZEKO_TMINA`, `LUMINA_SWAP_MINA_TZEKO`). Stores the raw fact with transaction hash, block height, and timestamp.
  - `leaderboard`: A pre-computed table with wallet addresses and their total scores. Updated by the indexer after processing each batch of actions.
  - `zeko_transactions`: A simple log of all transaction hashes on Zeko, used for the global transaction counter.

### 3.2. Indexing Layer

- **Technology:** **Node.js/Bun** service with an HTTP control server protected by Bearer token authentication.
- **Role:** To observe the Zeko blockchain, persist raw data, update the leaderboard table, and trigger real-time updates.
- **Responsibilities:**
  - Periodically fetch new on-chain events from Zeko blockchain since last processed block
  - Transform blockchain data into action records and perform efficient batch operations into the database
  - Calculate and update scores for each affected wallet using business logic and update the `leaderboard` table
  - Trigger broadcasts to the API service to notify connected clients of updates
  - Provide HTTP endpoints for administrative control (start/stop indexing, recalculate scores, rebuild leaderboard, manual broadcasts)
  - The Indexer contains the business logic to determine point values and apply caps per action type
- **Authentication:** All control endpoints are protected by Bearer token authentication for security

### 3.3. API Layer with Real-time Updates

- **Technology:** **Cloudflare Worker** running **GraphQL Yoga** with **Pothos** (for schema building), **Drizzle ORM** (for querying), and **Cloudflare Durable Objects** for real-time WebSocket connections.
- **Role:** To provide a performant GraphQL API for the frontend and manage real-time updates via WebSocket subscriptions.
- **GraphQL API Responsibilities:**
  - Queries the pre-computed `leaderboard` table with efficient keyset-based pagination
  - Supports wallet search to find specific user rankings
  - Exposes global transaction counter for Zeko blockchain activity
- **Real-time Update Architecture:**
  - Uses a distributed pub/sub system with Cloudflare Durable Objects
  - **UserDO (User Durable Object):** One instance per connected user, manages WebSocket connections
  - **DistributorDO (Distributor Durable Object):** Fixed pool of 100 shards for scalable fan-out distribution
  - When the indexer processes new data, it triggers all distributors in parallel, which fan out to subscribed users
  - Automatic cleanup of failed/disconnected subscribers
- **Scoring System** (implemented in the indexer):
  - **FAUCET_ZEKO_TMINA**: 10 points (only first occurrence counts)
  - **BRIDGE_MINA_TO_ZEKO** (Deposit): 20 points (only first occurrence counts)
  - **BRIDGE_ZEKO_TO_MINA** (Withdrawal): 20 points (only first occurrence counts)
  - **LUMINA_SWAP_MINA_TZEKO**: 5 points per swap, maximum 100 points total (first 20 occurrences)
  - **LUMINA_ADD_LIQUIDITY_MINA_TZEKO**: 10 points per liquidity addition, maximum 50 points total (first 5 occurrences)

### 3.4. Frontend

- **Technology:** **Vue.js** with **Urql** as the GraphQL client.
- **Role:** The public-facing, user-centric leaderboard application.
- **Responsibilities:**
  - Display the leaderboard table with pagination and the global Zeko transaction counter
  - Implement the **Query + Subscription** pattern: initially fetch data via GraphQL query, then maintain WebSocket connection for real-time updates
  - Support wallet search functionality to find specific user rankings

### 3.5. Admin Interface

- **Technology:** Basic web UI protected by **Cloudflare Access** for authentication.
- **Role:** Administrative control panel for managing the indexer service.
- **Responsibilities:**
  - Provide UI to control the indexer service (start/stop indexing, monitor status)
  - Trigger manual recalculation of leaderboard scores
  - Rebuild the leaderboard from scratch when business rules change
  - Manually trigger broadcasts to connected clients
- **Security:** Protected by Cloudflare Access, communicates with indexer using Bearer token authentication

## 4. Data Flow

### 4.1. Indexing Flow

1. Indexer periodically queries Zeko blockchain for new events since last processed block
2. Transforms blockchain events into normalized action records
3. Batch inserts actions into database with duplicate protection
4. Calculates score changes for affected wallets based on business rules
5. Updates leaderboard table with new scores
6. Triggers broadcast to API service's distributor shards
7. Distributors fan out updates to connected clients via WebSocket

### 4.2. Real-time Update Flow

1. Client connects to API service and establishes WebSocket connection
2. Client is assigned to one of 100 distributor shards using consistent hashing
3. When indexer processes new data, it triggers all distributors in parallel
4. Each distributor broadcasts to its subscribed clients
5. Clients receive updates and refetch leaderboard data

### 4.3. Admin Control Flow

1. Admin accesses admin UI (protected by Cloudflare Access)
2. Admin UI displays indexer status and control options
3. Admin actions (start/stop, recalculate, rebuild) are sent as authenticated requests to indexer
4. Indexer executes commands and returns status

## 5. Key Architecture Decisions

### Why Separate Indexer and API?

- **Scalability:** Indexer runs on dedicated infrastructure optimized for long-running processes, while API benefits from Cloudflare's edge network
- **Reliability:** Indexer can be restarted or reconfigured without affecting API availability
- **Security:** Indexer control is isolated and secured independently

### Why Durable Objects for Real-time?

- **Scalability:** 100-shard architecture distributes connection load and broadcast fan-out
- **Cost-Effectiveness:** Only pay for active connections with automatic hibernation
- **Low Latency:** Connections maintained at Cloudflare edge
- **Reliability:** Automatic cleanup of failed connections

### Why Pre-computed Leaderboard Table?

- **Performance:** Fast query response times regardless of action log size
- **Simplicity:** Standard SQL queries with window functions for ranking
- **Flexibility:** Can rebuild from action log when business rules change

### Why Event Sourcing?

- **Audit Trail:** Complete history of all actions for debugging and compliance
- **Flexibility:** Business rules can change without data migration—just recalculate from actions
- **Data Integrity:** Immutable action log prevents accidental data corruption
