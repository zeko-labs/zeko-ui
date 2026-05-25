import path from "node:path"
import { fileURLToPath } from "node:url"

export const shouldRunBridgeCli = ({
	argv1 = process.argv[1],
	moduleUrl
}: {
	argv1?: string
	moduleUrl: string
}): boolean => {
	if (!argv1) return false

	const modulePath = fileURLToPath(moduleUrl)
	if (path.resolve(argv1) === path.resolve(modulePath)) return true

	const executableName = path.basename(argv1).replace(/\.(?:cmd|ps1)$/i, "")
	return executableName === "zeko-bridge"
}
