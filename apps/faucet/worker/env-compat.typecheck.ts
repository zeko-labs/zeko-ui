import type { FaucetWorkerEnv } from "./types"

type AssertAssignable<Actual extends Expected, Expected> = true

// This file exists only because `FaucetWorkerEnv` is still handwritten. Its job is to make the
// build fail if Wrangler's generated faucet `Env` drifts away from that alias. Delete this file at
// the same time as the alias, once the faucet worker can use a generated non-global env interface
// without leaking faucet bindings into faucet-ui's typecheck program.
type FaucetWorkerEnvMatchesGeneratedEnv = AssertAssignable<Env, FaucetWorkerEnv>

export type _FaucetWorkerEnvMatchesGeneratedEnv = FaucetWorkerEnvMatchesGeneratedEnv
