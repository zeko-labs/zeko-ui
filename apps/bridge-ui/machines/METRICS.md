# Bridge UI Metrics

This document describes the metrics collected by the bridge UI for performance visibility and issue reporting.

## Purpose

Metrics focus on **operation timing and error tracking** to understand how long each step takes and identify issues. User interaction events (clicks, navigation) are not tracked.

## Collection Mechanism

### `act()` Wrapper

The primary collection method. Wraps async operations and automatically captures:

- **category**: Derived from logger prefix (e.g., `[BRIDGE]` → `bridge`)
- **action**: Operation label (e.g., `findPendingOperation`, `signTransaction`)
- **durationMs**: Time taken in milliseconds
- **success**: `true` if completed, `false` if threw
- **label**: Error message on failure

Usage in code:

```ts
const { act } = createLogger("[BRIDGE]", { metrics: true })

await act("operationName", async ({ stop }) => {
	// ... operation code
})
```

### Direct `sendMetric()` Calls

Used for specific events not wrapped by `act()`:

| Location             | Action     | Purpose                                  |
| -------------------- | ---------- | ---------------------------------------- |
| `bridgeOperation.ts` | `started`  | Tracks when user starts bridge operation |
| `transaction.ts`     | `feeRetry` | Tracks low-fee retry attempts            |

## Categories

| Category           | Source                      | Description                       |
| ------------------ | --------------------------- | --------------------------------- |
| `bridge`           | `[BRIDGE]` logger           | Bridge machine operations         |
| `bridge_operation` | `[BRIDGE_OPERATION]` logger | Individual bridge operation steps |
| `transaction`      | `[TRANSACTION]` logger      | SDK transaction lifecycle         |

## Tracked Operations

### Bridge (`bridge`)

- `findPendingOperation` — Queries for pending deposits/withdrawals

### Bridge Operation (`bridge_operation`)

- `submitDeposit` — Submits deposit transaction to L2
- `finalizeDeposit` — Finalizes deposit on L2
- `submitWithdrawal` — Submits withdrawal transaction to L1
- `finalizeWithdrawal` — Finalizes withdrawal on L1
- `cancelDeposit` — Cancels a pending deposit

### Transaction (`transaction`)

- `createSdkSignature` — Creates an SDK signature request
- `signTransaction` — Wallet signature request
- `completeSdkSignature` — Completes the SDK request with the signed transaction
- `feeRetry` — Fee-too-low retry (includes retry count and fee)

## Schema

Defined in `metrics.schema.ts`:

```ts
{
  category: "bridge" | "bridge_operation" | "transaction"
  action: string (max 100 chars)
  label?: string (max 500 chars) — error messages or metadata
  durationMs?: number — operation duration
  success?: boolean — completion status
  amount?: number — transaction amount (when applicable)
  source?: string — source network
  destination?: string — destination network
  walletAddress?: string — user wallet (cached per session)
  userAgent?: string — browser info
  cpuCores?: number — device cores
  language?: string — browser language
  screenResolution?: string — screen dimensions
  timestamp?: number — event time (ms since epoch)
}
```

## Storage

Metrics are sent to `/metrics` endpoint and stored in Cloudflare Analytics Engine (`BRIDGE_METRICS` dataset).

### Analytics Engine Format

- **index[0]**: category (for filtering)
- **blobs**: [category, action, label, source, destination, userAgent, walletAddress, language, screenResolution]
- **doubles**: [durationMs, amount, success (1/0/-1), timestamp, cpuCores]

## Privacy

- Wallet address is cached per session and cleared on account switch
- No PII beyond wallet address and standard browser metadata
- Localhost origin only allowed in development mode
