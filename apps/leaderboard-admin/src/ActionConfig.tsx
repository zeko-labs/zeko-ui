import type { Setter } from "solid-js"

export type ActionName = "deposit" | "faucet" | "liquidity" | "swap" | "withdrawal"

export interface ActionBlockConfig {
	startBlock: number
	endBlock: number
}

export type ActionsConfig = Partial<Record<ActionName, ActionBlockConfig>>

interface ActionConfigProps {
	actionName: ActionName
	label: string
	config: ActionsConfig
	setConfig: Setter<ActionsConfig>
}

function ActionConfig(props: ActionConfigProps) {
	const current = () => props.config[props.actionName]

	function update(field: "startBlock" | "endBlock", value: string) {
		const num = value === "" ? undefined : Number.parseInt(value, 10)

		props.setConfig((prev) => {
			const c = current()
			const startBlock = field === "startBlock" ? num ?? 0 : c?.startBlock ?? 0
			const endBlock =
				field === "endBlock"
					? num ?? Number.POSITIVE_INFINITY
					: c?.endBlock ?? Number.POSITIVE_INFINITY

			if (startBlock === 0 && endBlock === Number.POSITIVE_INFINITY) {
				const { [props.actionName]: _, ...rest } = prev
				return rest
			}

			return { ...prev, [props.actionName]: { startBlock, endBlock } }
		})
	}

	return (
		<fieldset>
			<legend>{props.label}</legend>
			<div class="grid">
				<label>
					Start Block
					<input
						type="number"
						value={current()?.startBlock ?? ""}
						placeholder="0"
						onInput={(e) => update("startBlock", e.currentTarget.value)}
					/>
				</label>
				<label>
					End Block
					<input
						type="number"
						value={
							current()?.endBlock === Number.POSITIVE_INFINITY ? "" : current()?.endBlock ?? ""
						}
						placeholder="∞"
						onInput={(e) => update("endBlock", e.currentTarget.value)}
					/>
				</label>
			</div>
		</fieldset>
	)
}

export default ActionConfig
