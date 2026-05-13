import { defineCommand, type CommandDef } from "citty"
import { createBridgeCommand } from "./bridge"
import { createDepositCommand, createWithdrawalCommand } from "./direct"
import { createDoctorCommand } from "./doctor"
import { createOperationCommand } from "./operation"
import { createTuiCommand } from "./tui"

export { createBridgeCommand, runBridgeOperation } from "./bridge"
export { createDepositCommand, createWithdrawalCommand } from "./direct"
export {
	runDepositCancel,
	runDepositFinalize,
	runDepositStatus,
	runDepositSubmit,
	runWithdrawalFinalize,
	runWithdrawalStatus,
	runWithdrawalSubmit
} from "./direct"
export { createDoctorCommand } from "./doctor"
export { loadBridgeCliEnv } from "./env"
export { createOperationCommand } from "./operation"
export { createTuiCommand, renderTuiSnapshot } from "./tui"
export * from "./args"
export * from "./decisions"
export * from "./env"
export * from "./routes"
export * from "./sdk"
export * from "./session"
export * from "./types"

export const createBridgeCliCommand = (): CommandDef =>
	defineCommand({
		meta: {
			name: "zeko-bridge",
			version: "0.0.0",
			description: "Agent-first CLI for bridging between Mina and Zeko."
		},
		subCommands: {
			bridge: createBridgeCommand(),
			deposit: createDepositCommand(),
			withdrawal: createWithdrawalCommand(),
			operation: createOperationCommand(),
			tui: createTuiCommand(),
			doctor: createDoctorCommand()
		}
	})
