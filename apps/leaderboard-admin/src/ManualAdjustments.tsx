import { createSignal, For, Show } from "solid-js"
import * as v from "valibot"
import { getApi } from "./api"

const ManualAdjustmentSchema = v.object({
	wallet: v.pipe(
		v.string(),
		v.nonEmpty("wallet cannot be empty"),
		v.length(55, "wallet must be 55 characters long")
	),
	pointsChange: v.pipe(
		v.number("pointsChange must be a number"),
		v.finite("pointsChange must be a finite number"),
		v.integer("pointsChange must be an integer")
	),
	sidequest: v.pipe(v.string(), v.nonEmpty("sidequest cannot be empty")),
	reason: v.optional(v.string())
})

const ManualAdjustmentsArraySchema = v.pipe(
	v.array(ManualAdjustmentSchema),
	v.minLength(1, "Array must contain at least one adjustment")
)

type ManualAdjustment = v.InferOutput<typeof ManualAdjustmentSchema>

interface ValidationError {
	index: number
	field: string
	message: string
}

export function ManualAdjustments() {
	const [jsonInput, setJsonInput] = createSignal("")
	const [parsedAdjustments, setParsedAdjustments] = createSignal<ManualAdjustment[] | null>(null)
	const [errors, setErrors] = createSignal<ValidationError[]>([])
	const [parseError, setParseError] = createSignal<string>("")
	const [submitting, setSubmitting] = createSignal(false)
	const [submitResult, setSubmitResult] = createSignal<{
		success: boolean
		message: string
	} | null>(null)

	function validateAdjustments(
		input: unknown
	): { success: true; data: ManualAdjustment[] } | { success: false; errors: ValidationError[] } {
		const result = v.safeParse(ManualAdjustmentsArraySchema, input)

		if (result.success) {
			return { success: true, data: result.output }
		}

		// Transform Valibot issues into our ValidationError format
		const validationErrors: ValidationError[] = []

		if (result.issues) {
			for (const issue of result.issues) {
				const path = issue.path
				// path looks like [{ key: 0 }, { key: 'wallet' }] for arr[0].wallet
				const index = (path?.[0]?.key as number) ?? -1
				const field = (path?.[1]?.key as string) ?? "general"

				validationErrors.push({
					index: typeof index === "number" ? index : -1,
					field,
					message: issue.message
				})
			}
		}

		return { success: false, errors: validationErrors }
	}

	function handleParse() {
		setParseError("")
		setErrors([])
		setParsedAdjustments(null)
		setSubmitResult(null)

		const input = jsonInput().trim()
		if (!input) {
			setParseError("Input is empty")
			return
		}

		try {
			const parsed = JSON.parse(input)
			const result = validateAdjustments(parsed)

			if (result.success) {
				setParsedAdjustments(result.data)
			} else {
				setErrors(result.errors)
			}
		} catch (err) {
			setParseError(`JSON parse error: ${(err as Error).message}`)
		}
	}

	async function handleSubmit() {
		const adjustments = parsedAdjustments()
		if (!adjustments) return

		setSubmitting(true)
		setSubmitResult(null)

		try {
			const res = await getApi().adjust.post(adjustments)

			if (res.status === 200 && res.data) {
				setSubmitResult({
					success: true,
					message: `Success: ${res.data.message}`
				})
				// Clear the form on success
				setJsonInput("")
				setParsedAdjustments(null)
			} else {
				setSubmitResult({
					success: false,
					message: res.error?.value ?? `Error: Status ${res.status}`
				})
			}
		} catch (err) {
			setSubmitResult({
				success: false,
				message: `Error: ${(err as Error).message}`
			})
		} finally {
			setSubmitting(false)
		}
	}

	function handleClear() {
		setJsonInput("")
		setParsedAdjustments(null)
		setErrors([])
		setParseError("")
		setSubmitResult(null)
	}

	const isValid = () => parsedAdjustments() !== null && errors().length === 0 && !parseError()

	return (
		<section>
			<h2>Manual Adjustments</h2>
			<article>
				<p>Paste a JSON array of manual adjustments.</p>
				<p>
					Required Fields : <code>wallet</code>, <code>pointsChange</code>, <code>sidequest</code>
				</p>
				<p>
					Optional Field : <code>reason</code>
				</p>

				<details>
					<summary>Example JSON format</summary>
					<pre style="white-space: pre-wrap; font-size: 0.875rem">
						{JSON.stringify(
							[
								{
									wallet: "B62qtest1",
									pointsChange: 50,
									sidequest: "Community Event",
									reason: "Won the meme contest"
								},
								{
									wallet: "B62qtest2",
									pointsChange: -10,
									sidequest: "Rule Violation",
									reason: "Spam detected"
								},
								{
									wallet: "B62qtest3",
									pointsChange: 100,
									sidequest: "Bug Bounty"
								}
							],
							null,
							2
						)}
					</pre>
				</details>

				<label for="adjustments-json">
					Adjustments JSON
					<textarea
						id="adjustments-json"
						name="adjustments-json"
						rows={10}
						placeholder='[{"wallet": "B62q...", "pointsChange": 50, "sidequest": "Event Name", "reason": "Optional"}]'
						value={jsonInput()}
						onInput={(e) => setJsonInput(e.currentTarget.value)}
					/>
				</label>

				<div class="grid">
					<button type="button" onClick={handleParse} disabled={!jsonInput().trim()}>
						Parse & Validate
					</button>
					<button type="button" class="secondary" onClick={handleClear}>
						Clear
					</button>
				</div>

				<Show when={parseError()}>
					<article style="border-left: 4px solid red">
						<strong>Parse Error:</strong>
						<p>{parseError()}</p>
					</article>
				</Show>

				<Show when={errors().length > 0}>
					<article style="border-left: 4px solid red">
						<strong>Validation Errors:</strong>
						<ul>
							<For each={errors()}>
								{(error) => (
									<li>
										Item {error.index} - <strong>{error.field}</strong>: {error.message}
									</li>
								)}
							</For>
						</ul>
					</article>
				</Show>

				<Show when={parsedAdjustments()}>
					<article style="border-left: 4px solid green">
						<strong>Valid Adjustments ({parsedAdjustments()?.length}):</strong>
						<table>
							<thead>
								<tr>
									<th>#</th>
									<th>Wallet</th>
									<th>Points Change</th>
									<th>Sidequest</th>
									<th>Reason</th>
								</tr>
							</thead>
							<tbody>
								<For each={parsedAdjustments()}>
									{(adj, index) => (
										<tr>
											<td>{index() + 1}</td>
											<td>
												<code style="font-size: 0.75rem">{adj.wallet}</code>
											</td>
											<td
												style={{
													color: adj.pointsChange >= 0 ? "green" : "red",
													"font-weight": "bold"
												}}
											>
												{adj.pointsChange >= 0 ? "+" : ""}
												{adj.pointsChange}
											</td>
											<td>{adj.sidequest}</td>
											<td>{adj.reason || "-"}</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>

						<button
							type="button"
							onClick={handleSubmit}
							disabled={!isValid() || submitting()}
							aria-busy={submitting()}
						>
							{submitting() ? "Submitting..." : `Submit ${parsedAdjustments()?.length} Adjustments`}
						</button>
					</article>
				</Show>

				<Show when={submitResult()}>
					<article
						style={{
							"border-left": submitResult()?.success ? "4px solid green" : "4px solid red"
						}}
					>
						<strong>{submitResult()?.success ? "✓ Success" : "✗ Error"}:</strong>
						<p>{submitResult()?.message}</p>
					</article>
				</Show>
			</article>
		</section>
	)
}
