import type { Setter } from "solid-js"
import ActionConfig, { type ActionsConfig } from "./ActionConfig"

interface ActionConfigsProps {
	config: ActionsConfig
	setConfig: Setter<ActionsConfig>
}

export function ActionConfigs(props: ActionConfigsProps) {
	return (
		<div>
			{(
				[
					{ actionName: "deposit", label: "Bridge Deposit" },
					{ actionName: "faucet", label: "Faucet" },
					{ actionName: "liquidity", label: "Add Liquidity" },
					{ actionName: "swap", label: "Swap" },
					{ actionName: "withdrawal", label: "Bridge Withdrawal" }
				] as const
			).map(({ actionName, label }) => (
				<ActionConfig
					actionName={actionName}
					label={label}
					config={props.config}
					setConfig={props.setConfig}
				/>
			))}
		</div>
	)
}
