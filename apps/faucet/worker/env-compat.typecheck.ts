import type { FaucetWorkerEnv } from "./types"

type AssertAssignable<Actual extends Expected, Expected> = true

type FaucetWorkerEnvMatchesGeneratedEnv = AssertAssignable<Env, FaucetWorkerEnv>

export type _FaucetWorkerEnvMatchesGeneratedEnv = FaucetWorkerEnvMatchesGeneratedEnv
