import { createResource, createSignal, Show } from "solid-js"
import * as api from "./api"

function App() {
	const [authToken, setAuthToken] = createSignal("admin")
	const [status, setStatus] = createSignal("unknown")
	const [startingBlock, setStartingBlock] = createSignal(0)
	const [intervalSeconds, setIntervalSeconds] = createSignal(60)
	const [maxRetries, setMaxRetries] = createSignal(5)
	const [fromBlock, setFromBlock] = createSignal(0)

	// Use createResource to fetch the indexer status. It re-fetches when authToken changes
	const [statusResource, { refetch: refetchStatus }] = createResource(
		() => authToken(),
		async (token) => {
			const res = await api.getStatus(token)
			setStatus(res?.status ?? "unknown")
			return res
		}
	)

	async function handleStart() {
		const token = authToken()
		const payload = {
			startingBlock: startingBlock(),
			intervalSeconds: intervalSeconds(),
			maxRetries: maxRetries()
		}
		await api.start(token, payload)
		await refetchStatus()
	}

	async function handleStop() {
		const token = authToken()
		await api.stop(token)
		await refetchStatus()
	}

	async function handleBroadcast() {
		const token = authToken()
		await api.broadcast(token)
		await refetchStatus()
	}

	async function handleRecalculate() {
		const token = authToken()
		await api.recalculate(token)
		await refetchStatus()
	}

	async function handleRebuild() {
		const token = authToken()
		await api.rebuild(token, { fromBlock: fromBlock() })
		await refetchStatus()
	}

	return (
		<main class="container">
			<h1>Leaderboard Admin</h1>

			<section>
				<h2>Authentication</h2>
				<label for="authToken">Auth Token</label>
				<input
					type="password"
					id="authToken"
					name="authToken"
					value={authToken()}
					onInput={(e) => setAuthToken(e.currentTarget.value)}
				/>
			</section>

			<section>
				<h2>Indexer Status</h2>
				<Show
					when={statusResource.loading}
					fallback={
						<p>
							Current status: <strong>{status()}</strong>
						</p>
					}
				>
					<p>Loading status…</p>
				</Show>
				<button type="button" onClick={() => void refetchStatus()}>
					Refresh Status
				</button>
			</section>

			<section>
				<h2>Indexer Control</h2>
				<article>
					<h3>Start Indexer</h3>
					<div class="grid">
						<label for="startingBlock">
							Starting Block
							<input
								type="number"
								id="startingBlock"
								name="startingBlock"
								value={startingBlock()}
								onInput={(e) => setStartingBlock(Number.parseInt(e.currentTarget.value))}
							/>
						</label>
						<label for="intervalSeconds">
							Interval (seconds)
							<input
								type="number"
								id="intervalSeconds"
								name="intervalSeconds"
								value={intervalSeconds()}
								onInput={(e) => setIntervalSeconds(Number.parseInt(e.currentTarget.value))}
							/>
						</label>
						<label for="maxRetries">
							Max Retries
							<input
								type="number"
								id="maxRetries"
								name="maxRetries"
								value={maxRetries()}
								onInput={(e) => setMaxRetries(Number.parseInt(e.currentTarget.value))}
							/>
						</label>
					</div>
					<button type="button" onClick={() => void handleStart()}>
						Start
					</button>
				</article>
				<article>
					<h3>Stop Indexer</h3>
					<button type="button" class="secondary" onClick={() => void handleStop()}>
						Stop
					</button>
				</article>
			</section>

			<section>
				<h2>Actions</h2>
				<div class="grid">
					<button type="button" onClick={() => void handleBroadcast()}>
						Trigger Distributor Broadcast
					</button>
					<button type="button" onClick={() => void handleRecalculate()}>
						Recalculate Leaderboard
					</button>
				</div>
			</section>

			<section>
				<h2>Maintenance</h2>
				<article>
					<h3>Rebuild Leaderboard</h3>
					<label for="fromBlock">
						From Block
						<input
							type="number"
							id="fromBlock"
							name="fromBlock"
							value={fromBlock()}
							onInput={(e) => setFromBlock(Number.parseInt(e.currentTarget.value))}
						/>
					</label>
					<button type="button" onClick={() => void handleRebuild()}>
						Rebuild
					</button>
				</article>
			</section>
		</main>
	)
}

export default App
