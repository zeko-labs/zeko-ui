import { DurableObject } from "cloudflare:workers"
import { MUTEX_ACQUIRE_ATTEMPTS, MUTEX_LEASE_MS, MUTEX_STORAGE_KEY } from "./constants"
import type {
	ClaimMutexAcquireResult,
	ClaimMutexHandle,
	ClaimMutexLease,
	ClaimMutexStub,
	FaucetRuntimeEnv
} from "./types"

// ClaimMutex instances are short-lived mutexes only. Durable claim policy stays in KV.
export class ClaimMutex extends DurableObject<Env> {
	async acquire({
		leaseId,
		now,
		ttlMs
	}: {
		leaseId: string
		now: number
		ttlMs: number
	}): Promise<ClaimMutexAcquireResult> {
		const existing = await this.ctx.storage.get<ClaimMutexLease>(MUTEX_STORAGE_KEY)
		if (existing && existing.expiresAt > now) {
			return {
				ok: false,
				retryAfterMs: Math.max(1, existing.expiresAt - now)
			}
		}

		await this.ctx.storage.put(MUTEX_STORAGE_KEY, {
			leaseId,
			expiresAt: now + ttlMs
		} satisfies ClaimMutexLease)

		return { ok: true }
	}

	// Releasing requires the matching leaseId so stale callers cannot clear a newer lease.
	async release({ leaseId }: { leaseId: string }) {
		const existing = await this.ctx.storage.get<ClaimMutexLease>(MUTEX_STORAGE_KEY)
		if (existing?.leaseId === leaseId) await this.ctx.storage.delete(MUTEX_STORAGE_KEY)
		return { ok: true }
	}
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const acquireMutex = async (
	env: FaucetRuntimeEnv,
	resource: string
): Promise<ClaimMutexHandle | null> => {
	const stub = env.CLAIM_MUTEX.get(
		env.CLAIM_MUTEX.idFromName(resource)
	) as unknown as ClaimMutexStub

	for (let attempt = 0; attempt < MUTEX_ACQUIRE_ATTEMPTS; attempt += 1) {
		const leaseId = crypto.randomUUID()
		const result = (await stub.acquire({
			leaseId,
			now: Date.now(),
			ttlMs: MUTEX_LEASE_MS
		})) as ClaimMutexAcquireResult

		if (result.ok) {
			return {
				leaseId,
				resource,
				stub
			}
		}

		if (attempt < MUTEX_ACQUIRE_ATTEMPTS - 1) await delay(Math.min(result.retryAfterMs, 25))
	}

	console.warn(`Timed out acquiring mutex for ${resource}`)
	return null
}

export const releaseMutexes = async (locks: ClaimMutexHandle[]) => {
	for (const lock of [...locks].reverse()) {
		try {
			await lock.stub.release({ leaseId: lock.leaseId })
		} catch (error) {
			console.error(`Failed to release mutex ${lock.resource}:`, error)
		}
	}
}
