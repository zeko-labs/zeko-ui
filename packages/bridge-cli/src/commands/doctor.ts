import { defineCommand, type CommandDef } from "citty"
import { resolveAppPaths } from "../core/paths"
import { resolveSignerSecrets } from "../core/signer"
import { KNOWN_ROUTES } from "../core/routes"

export const createDoctorCommand = (): CommandDef =>
	defineCommand({
		meta: {
			name: "doctor",
			description: "Check CLI prerequisites and environment configuration."
		},
		async run() {
			const paths = resolveAppPaths()
			const secrets = (() => {
				try {
					return { ok: true, value: resolveSignerSecrets() }
				} catch (error) {
					return { ok: false, message: error instanceof Error ? error.message : String(error) }
				}
			})()
			console.log(
				[
					"bridge doctor",
					`Data dir: ${paths.dataDir}`,
					`State dir: ${paths.stateDir}`,
					`Log dir: ${paths.logDir}`,
					`Mina signer: ${secrets.ok ? "configured" : secrets.message}`,
					`Known routes: ${KNOWN_ROUTES.map((route) => `${route.from}->${route.to}`).join(", ")}`
				].join("\n")
			)
		}
	})
