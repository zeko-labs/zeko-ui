import { createResource, createSignal, onCleanup, onMount, Show } from "solid-js"
import { clearStoredToken, getApi, getStoredToken, type Indexer, setStoredToken } from "./api"
import Token from "./Token"

interface Status {
	status: string
	start: string
	stop: string
	broadcast: string
	recalculate: string
	rebuild: string
}

function App() {
	const [opStatus, setOpStatus] = createSignal<Status>({
		status: "",
		start: "",
		stop: "",
		broadcast: "",
		recalculate: "",
		rebuild: ""
	})
	const [startingBlock, setStartingBlock] = createSignal(0)
	const [intervalSeconds, setIntervalSeconds] = createSignal(2)
	const [maxRetries, setMaxRetries] = createSignal(5)
	const [fromBlock, setFromBlock] = createSignal(0)

	const [token, setToken] = createSignal<string>(getStoredToken())
	const [input, setInput] = createSignal("")

	function save() {
		const v = input().trim()
		if (!v) return
		setStoredToken(v)
		setToken(getStoredToken())
		setInput("")
	}

	function del() {
		clearStoredToken()
		setToken(getStoredToken())
	}

	const setData = (response: { data: unknown; status: number }, key: keyof Status) => {
		const message = response.data
			? JSON.stringify(response.data, null, 2)
			: `Status ${response.status}`
		setOpStatus((p) => ({ ...p, [key]: message }))
	}

	const [statusResource, { refetch: refetchStatus }] = createResource<ReturnType<
		Indexer["getStatus"]
	> | null>(async () => {
		try {
			const res = await getApi().status.get()
			if (res.status === 200 && res.data) {
				setOpStatus((p) => ({ ...p, status: "ok" }))
				return res.data
			} else {
				setOpStatus((p) => ({ ...p, status: `Error: ${res.status}` }))
				return null
			}
		} catch (err) {
			setOpStatus((p) => ({ ...p, status: (err as Error).message }))
			return null
		}
	})

	// Handlers for server actions
	async function handleStart() {
		try {
			const body = {
				startingBlock: startingBlock(),
				intervalSeconds: intervalSeconds(),
				maxRetries: maxRetries()
			}
			const res = await getApi().start.post(body)
			setData(res, "start")
			refetchStatus()
		} catch (err) {
			setOpStatus((p) => ({ ...p, start: (err as Error).message }))
		}
	}

	async function handleStop() {
		try {
			const res = await getApi().stop.post()
			setData(res, "stop")
		} catch (err) {
			setOpStatus((p) => ({ ...p, stop: (err as Error).message }))
		}
	}

	async function handleBroadcast() {
		try {
			const res = await getApi().broadcast.post()
			setData(res, "broadcast")
		} catch (err) {
			setOpStatus((p) => ({ ...p, broadcast: (err as Error).message }))
		}
	}

	async function handleRecalculate() {
		try {
			const res = await getApi().recalculate.post()
			setData(res, "recalculate")
		} catch (err) {
			setOpStatus((p) => ({ ...p, recalculate: (err as Error).message }))
		}
	}

	async function handleRebuild() {
		try {
			const res = await getApi().rebuild.post({ fromBlock: fromBlock() })
			setData(res, "rebuild")
		} catch (err) {
			setOpStatus((p) => ({ ...p, rebuild: (err as Error).message }))
		}
	}

	onMount(() => {
		refetchStatus()
		const id = window.setInterval(() => {
			if (typeof document !== "undefined" && document.visibilityState === "visible") {
				refetchStatus()
			}
		}, 5000)
		onCleanup(() => clearInterval(id))
	})

	return (
		<main class="container">
			<h1>Leaderboard Admin</h1>
			<Token token={token} input={input} setInput={setInput} save={save} del={del} />
			<section>
				<h2>Indexer Status</h2>
				<Show
					when={statusResource()}
					fallback={
						<p>
							Current status: <strong>{opStatus().status}</strong>
						</p>
					}
				>
					<div>
						<dl>
							<dt>Running</dt>
							<dd>{String(statusResource()?.isRunning)}</dd>
							<dt>Last Run</dt>
							<dd>{statusResource()?.lastRunDate ?? "N/A"}</dd>
							<dt>Config</dt>
							<dd>
								<pre style="white-space: pre-wrap">
									{JSON.stringify(statusResource()?.config, null, 2)}
								</pre>
							</dd>
						</dl>

						<section>
							<h4>Operation results</h4>
							<ul>
								{Object.entries(opStatus()).map(([k, v]) => (
									<li>
										<strong>{k}</strong>: <pre style="white-space: pre-wrap">{v}</pre>
									</li>
								))}
							</ul>
						</section>
					</div>
				</Show>
				<button type="button" onClick={() => refetchStatus()}>
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
					<div class="grid">
						<button type="button" onClick={() => handleStart()}>
							Start
						</button>
						<button type="button" class="secondary" onClick={() => handleStop()}>
							Stop
						</button>
					</div>
				</article>
			</section>

			<section>
				<h2>Actions</h2>
				<div class="grid">
					<button type="button" onClick={() => handleBroadcast()}>
						Trigger Distributor Broadcast
					</button>
					<button type="button" onClick={() => handleRecalculate()}>
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
					<button type="button" onClick={() => handleRebuild()}>
						Rebuild
					</button>
				</article>
			</section>
		</main>
	)
}

export default App
