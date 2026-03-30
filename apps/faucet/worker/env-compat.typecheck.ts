import type { FaucetWorkerEnv } from "./types"

type AssertAssignable<Actual extends Expected, Expected> = true

// This file exists only to stop the handwritten alias from drifting away from Wrangler's generated
// faucet `Env`. Delete it once `FaucetWorkerEnv` is gone and the worker can use generated env types
// directly everywhere.
type FaucetWorkerEnvMatchesGeneratedEnv = AssertAssignable<Env, FaucetWorkerEnv>

export type _FaucetWorkerEnvMatchesGeneratedEnv = FaucetWorkerEnvMatchesGeneratedEnv
