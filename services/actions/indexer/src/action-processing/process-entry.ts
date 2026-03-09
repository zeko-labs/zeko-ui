import { processArchiveBlocks } from "./core"
import type { ProcessRequest, ProcessResponse } from "./process-protocol"

const readStdin = async (): Promise<string> =>
	new Promise((resolve, reject) => {
		let body = ""
		process.stdin.setEncoding("utf8")
		process.stdin.on("data", (chunk) => {
			body += chunk
		})
		process.stdin.on("end", () => {
			resolve(body)
		})
		process.stdin.on("error", (error) => {
			reject(error)
		})
	})

const run = async () => {
	let response: ProcessResponse
	try {
		const input = await readStdin()
		const request = JSON.parse(input) as ProcessRequest
		const result = processArchiveBlocks({
			blocks: request.blocks,
			strategy: "worker"
		})
		response = {
			ok: true,
			result
		}
	} catch (error) {
		response = {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		}
	}

	await new Promise<void>((resolve, reject) => {
		process.stdout.write(JSON.stringify(response), (error) => {
			if (error) {
				reject(error)
				return
			}
			resolve()
		})
	})
	process.exitCode = response.ok ? 0 : 1
}

void run()
