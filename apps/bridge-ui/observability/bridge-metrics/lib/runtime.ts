import { fileURLToPath } from "node:url"
import process from "node:process"

export const DEFAULT_CLOUDFLARE_ACCOUNT_ID = "a12d2915bc16ee8550f19399839623f7"
export const DEFAULT_AE_DATASET = "bridge_metrics"
export const DEFAULT_GRAFANA_DATASOURCE_UID = "dfftad89t7pxcc"
export const GRAFANA_CLICKHOUSE_DATASOURCE_TYPE = "vertamedia-clickhouse-datasource"
export const GRAFANA_CLICKHOUSE_DATASOURCE_NAME = "Altinity ClickHouse datasource"
export const OBSERVABILITY_ROOT = fileURLToPath(new URL("..", import.meta.url))
export const BRIDGE_UI_ROOT = fileURLToPath(new URL("../../..", import.meta.url))

export type RenderMode = "live" | "grafana" | "render"

export const readOptionalEnv = (name: string): string | undefined => {
	const value = process.env[name]?.trim()
	return value ? value : undefined
}

export const readRequiredEnv = (name: string): string => {
	const value = readOptionalEnv(name)

	if (!value) {
		throw new Error(`${name} is required.`)
	}

	return value
}

export const resolveCloudflareAccountId = (): string =>
	readOptionalEnv("CLOUDFLARE_ACCOUNT_ID") ?? DEFAULT_CLOUDFLARE_ACCOUNT_ID

export const resolveAeDataset = (): string => readOptionalEnv("AE_DATASET") ?? DEFAULT_AE_DATASET

export const resolveGrafanaDatasourceUid = (): string =>
	readOptionalEnv("GRAFANA_DATASOURCE_UID") ?? DEFAULT_GRAFANA_DATASOURCE_UID

export const resolveGrafanaDatasourceType = (): string =>
	readOptionalEnv("GRAFANA_DATASOURCE_TYPE") ?? GRAFANA_CLICKHOUSE_DATASOURCE_TYPE

export const resolveLiveAeConfig = () => ({
	accountId: resolveCloudflareAccountId(),
	dataset: resolveAeDataset(),
	token: readRequiredEnv("CLOUDFLARE_API_TOKEN")
})

export const parseCliArgs = (argv: string[]): Map<string, string | true> => {
	const args = new Map<string, string | true>()

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index]

		if (!token?.startsWith("--")) {
			continue
		}

		const [rawKey, inlineValue] = token.slice(2).split("=", 2)

		if (inlineValue !== undefined) {
			args.set(rawKey, inlineValue)
			continue
		}

		const nextToken = argv[index + 1]

		if (!nextToken || nextToken.startsWith("--")) {
			args.set(rawKey, true)
			continue
		}

		args.set(rawKey, nextToken)
		index += 1
	}

	return args
}

export const readStringArg = (
	args: Map<string, string | true>,
	name: string,
	defaultValue?: string
): string | undefined => {
	const value = args.get(name)

	if (typeof value === "string") {
		return value
	}

	return defaultValue
}

export const readBooleanArg = (args: Map<string, string | true>, name: string): boolean =>
	args.get(name) === true
