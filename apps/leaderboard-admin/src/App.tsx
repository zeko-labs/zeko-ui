import { createResource, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { ActionsConfig } from "./ActionConfig"
import { ActionConfigs } from "./ActionConfigs"
import { clearStoredToken, getApi, getStored, type Indexer, STORAGE_KEYS, setStored } from "./api"
import { ManualAdjustments } from "./ManualAdjustments"
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
	const createPersistedSignal = <T,>(key: string, defaultValue: T) => {
		const [signal, setSignalInternal] = createSignal<T>(getStored(key, defaultValue))
		const setSignal = (value: T | ((prev: T) => T)) => {
			const resolved = typeof value === "function" ? (value as (prev: T) => T)(signal()) : value
			setSignalInternal(() => resolved)
			setStored(key, resolved)
		}
		return [signal, setSignal] as const
	}

	const [globalStartingBlock, setGlobalStartingBlock] = createPersistedSignal(
		STORAGE_KEYS.globalStartingBlock,
		0
	)
	const [intervalSeconds, setIntervalSeconds] = createPersistedSignal(
		STORAGE_KEYS.intervalSeconds,
		5
	)
	const [maxRetries, setMaxRetries] = createPersistedSignal(STORAGE_KEYS.maxRetries, 10)
	const [actionsConfig, setActionsConfig] = createPersistedSignal<ActionsConfig>(
		STORAGE_KEYS.actions,
		{}
	)

	const [token, setToken] = createSignal<string>(getStored(STORAGE_KEYS.token, ""))
	const [input, setInput] = createSignal("")

	function save() {
		const v = input().trim()
		if (!v) return
		setStored(STORAGE_KEYS.token, v)
		setToken(getStored(STORAGE_KEYS.token, ""))
		setInput("")
	}

	function del() {
		clearStoredToken()
		setToken(getStored(STORAGE_KEYS.token, ""))
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
			const actions = actionsConfig()
			const hasActions = Object.keys(actions).length > 0
			const body = {
				startingBlock: globalStartingBlock(),
				intervalSeconds: intervalSeconds(),
				maxRetries: maxRetries(),
				...(hasActions && { actions })
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
			const actions = actionsConfig()
			const hasActions = Object.keys(actions).length > 0
			const res = await getApi().rebuild.post({
				fromBlock: globalStartingBlock(),
				...(hasActions && { actions })
			})
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
							<dt>Module States</dt>
							<dd>
								<pre style="white-space: pre-wrap">
									{JSON.stringify(statusResource()?.moduleStates, null, 2)}
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
			</section>

			<section>
				<h2>Indexer Control</h2>
				<article>
					<h3>Start Indexer</h3>
					<div class="grid">
						<label for="intervalSeconds">
							Interval (seconds)
							<input
								type="number"
								id="intervalSeconds"
								name="intervalSeconds"
								value={intervalSeconds()}
								onInput={(e) => setIntervalSeconds(Number.parseInt(e.currentTarget.value, 10))}
							/>
						</label>
						<label for="maxRetries">
							Max Retries
							<input
								type="number"
								id="maxRetries"
								name="maxRetries"
								value={maxRetries()}
								onInput={(e) => setMaxRetries(Number.parseInt(e.currentTarget.value, 10))}
							/>
						</label>
					</div>

					<div class="grid">
						<button
							type="button"
							disabled={statusResource()?.isRunning === true}
							onClick={() => handleStart()}
						>
							Start
						</button>
						<button
							disabled={statusResource()?.isRunning === false}
							type="button"
							class="secondary"
							onClick={() => handleStop()}
						>
							Stop
						</button>
					</div>
				</article>
			</section>

			<section>
				<h2>Actions</h2>
				<article>
					<div class="grid">
						<button type="button" onClick={() => handleRebuild()}>
							Rebuild
						</button>
						<button type="button" class="secondary" onClick={() => handleRecalculate()}>
							Recalculate
						</button>
					</div>
				</article>
			</section>

			<ManualAdjustments />

			<section>
				<h2>Configuration</h2>
				<label for="globalStartingBlock">
					Global Block
					<input
						type="number"
						id="globalStartingBlock"
						name="globalStartingBlock"
						value={globalStartingBlock()}
						onInput={(e) => setGlobalStartingBlock(Number.parseInt(e.currentTarget.value, 10))}
					/>
				</label>
				<ActionConfigs config={actionsConfig()} setConfig={setActionsConfig} />
			</section>
		</main>
	)
}

export default App
