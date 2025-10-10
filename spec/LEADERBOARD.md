# Real-Time Leaderboard: Architecture Overview

## 1. Introduction

This document outlines the high-level architecture for a real-time leaderboard for the Zeko (Mina L2) contest. The primary goal is to create a flexible, scalable, and maintainable system that can track on-chain user actions, display a live ranking, and adapt to changing business rules.

The architecture is a **decoupled, custom stack** built on Cloudflare Workers and Supabase, centered around an **Event Sourcing** pattern. This approach prioritizes a clean separation of concerns, ensuring that the recording of raw data (indexing) is distinct from the interpretation and calculation of points (business logic).

## 2. Core Principles

- **Event Sourcing as the Source of Truth:** We will not store mutable scores directly. Instead, we will store an immutable log of all actions (`events`). The leaderboard is a projection of this log, calculated on the fly. This provides a full audit trail and allows business rules to be changed without data migration.
- **Separation of Concerns:** The **Indexer** is a dumb pipeline responsible only for recording facts. The **API Layer** is responsible for interpreting those facts according to business rules.
- **Flexibility Over Premature Optimization:** The design must gracefully handle changes to business logic, such as the "once per contest" vs. "once per day" requirement for awarding points.

## 3. Component Breakdown

### 3.1. Database

- **Technology:** **Supabase** (Postgres) with **Drizzle ORM**.
- **Role:** Acts as the single, durable source of truth for the entire system.
- **Schema Pattern:** The database will store the immutable event log plus a pre-computed leaderboard table. Drizzle will be used to define the schema in TypeScript, providing type safety and easy migrations.
  - `actions`: A log of all relevant on-chain actions performed by users (e.g., `FAUCET_USE`, `SWAP_ONCE`). It stores the raw fact, not the points.
  - `manual_adjustments`: A log of points added or removed by the admin.
  - `leaderboard`: A pre-computed table with wallet addresses and their total scores. Updated by the indexer.
  - `zeko_transactions`: A simple log of all transaction hashes on Zeko, used for the global transaction counter.

### 3.2. Indexing Layer

- **Technology:** **Cloudflare Worker** running on a **Cron Trigger**.
- **Role:** To observe the Mina and Zeko blockchains, persist raw data, and update the leaderboard table.
- **Responsibilities:**
  - Periodically fetch new on-chain events/state since its last run.
  - Transform this data into the schema format (e.g., `userId`, `actionType`, `txHash`).
  - Perform efficient batch `INSERT` operations into the Supabase tables (`actions`, `zeko_transactions`).
  - **Calculate and update scores:** For each affected wallet, recalculate the total score using the business logic and `UPSERT` into the `leaderboard` table.
  - The Indexer contains the business logic (via `scoring.ts`) to determine point values and apply caps per action type.

### 3.3. API Layer

- **Technology:** **Cloudflare Worker** running **GraphQL Yoga** with **Pothos** (for schema building) and **Drizzle ORM** (for querying). This can be the same Worker deployment as the Indexer.
- **Role:** To provide a simple, performant GraphQL API for the frontend and admin UI.
- **Responsibilities:**
  - **Leaderboard Query:** Queries the pre-computed `leaderboard` table with simple cursor-based pagination. Calculates ranks on-the-fly using a window function.
  - **Scoring System** (implemented in the indexer):
    - **FAUCET_ZEKO_TMINA**: 10 points (only the first occurrence counts)
    - **BRIDGE_MINA_TO_ZEKO**: 20 points (only the first occurrence counts)
    - **BRIDGE_ZEKO_TO_MINA**: 20 points (only the first occurrence counts)
    - **LUMINA_SWAP_MINA_TZEKO**: 5 points per swap, up to a maximum of 100 points total (only the first 20 occurrences count)
    - **LUMINA_ADD_LIQUIDITY_MINA_TZEKO**: 10 points per liquidity addition, up to a maximum of 50 points total (only the first 5 occurrences count)
  - **GraphQL Schema:** Exposes queries like `leaderboard(input: { cursor, searchWallet })` and `getZekoTransactionCount`.
  - **Mutations:** Exposes the `adjustPoints` mutation for the admin.
  - **Authentication:** Verifies signatures for protected mutations.

### 3.4. Real-time Layer

- **Technology:** **Cloudflare Durable Object**.
- **Role:** To manage persistent client connections and push updates for a live experience.
- **Responsibilities:**
  - Acts as a simple **Pub/Sub hub** for GraphQL Subscriptions.
  - When the API layer processes a mutation (like `adjustPoints`) or when the Indexer runs, the API layer will publish a notification (e.g., `'leaderboard_updated'`) to the Durable Object.
  - The Durable Object broadcasts this notification to all connected frontend clients, which then triggers a refetch of the main `getLeaderboard` query.

### 3.5. Frontend

- **Technology:** **Vue.js** with **Urql** as the GraphQL client.
- **Role:** The public-facing, user-centric leaderboard application.
- **Responsibilities:**
  - Display the leaderboard table and the global Zeko transaction counter.
  - Implement the **Query + Subscription/Refetch** pattern. It will initially fetch data with a `getLeaderboard` query and then listen for updates via an `onLeaderboardUpdate` subscription to trigger seamless data refreshing.

### 3.6. Admin

- **Technology:** A simple, dedicated web UI (can be a separate route within the main Vue app).
- **Role:** A purpose-built tool for the contest administrator.
- **Responsibilities:**
  - Provide a simple form for the admin to add or remove points for a specific user.
  - This form will call the `adjustPoints` GraphQL mutation, authenticating the request via a wallet signature.

### 3.7. Authentication

- **Technology:** **Mina Wallet Message Signing**.
- **Role:** To secure the admin-only `adjustPoints` mutation.
- **Flow:**
  1. The admin UI prompts the designated admin user to sign a static message (e.g., a challenge token).
  2. The resulting signature and the admin's public key are sent with the `adjustPoints` GraphQL request.
  3. The API Layer verifies that the signature is valid and was produced by the known, hardcoded admin public key before executing the mutation. This provides a simple yet secure authentication mechanism for a single admin user.
