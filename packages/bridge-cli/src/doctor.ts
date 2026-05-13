import { defineCommand, type CommandDef } from "citty"
import { resolveAppPaths } from "./env"
import { KNOWN_ROUTES } from "./routes"
import { resolveSignerKeys } from "./sdk"
import { formatErrorMessage } from "./utils"

export const createDoctorCommand = (
	deps: {
		resolvePaths?: typeof resolveAppPaths
		resolveKeys?: typeof resolveSignerKeys
		write?: (message: string) => void
	} = {}
): CommandDef =>
	defineCommand({
		meta: { name: "doctor", description: "Check CLI prerequisites and environment configuration." },
		async run() {
			const paths = (deps.resolvePaths ?? resolveAppPaths)()
			const keyConfig = (() => {
				try {
					return { ok: true as const, value: (deps.resolveKeys ?? resolveSignerKeys)() }
				} catch (error) {
					return { ok: false as const, message: formatErrorMessage(error) }
				}
			})()
			;(deps.write ?? console.log)(
				[
					"bridge doctor",
					`Data dir: ${paths.dataDir}`,
					`State dir: ${paths.stateDir}`,
					`Log dir: ${paths.logDir}`,
					`Wallet private key: ${keyConfig.ok ? "configured" : keyConfig.message}`,
					`Known routes: ${KNOWN_ROUTES.map((route) => `${route.from}->${route.to}`).join(", ")}`
				].join("\n")
			)
		}
	})
