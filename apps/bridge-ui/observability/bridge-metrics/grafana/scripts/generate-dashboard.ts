import { mkdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import process from "node:process"
import { dashboardPanels, type DashboardPanel } from "../dashboard-manifest.ts"
import { loadQueryTemplate, renderQueryTemplate } from "../../lib/sql.ts"
import {
	GRAFANA_CLICKHOUSE_DATASOURCE_NAME,
	OBSERVABILITY_ROOT,
	parseCliArgs,
	readStringArg,
	resolveAeDataset,
	resolveGrafanaDatasourceType,
	resolveGrafanaDatasourceUid,
	type RenderMode
} from "../../lib/runtime.ts"

const defaultOutputPath = resolve(OBSERVABILITY_ROOT, "grafana/bridge-ui.analytics.dashboard.json")

type DatasourceReference = {
	type: string
	uid: string
}

type DatasourceBinding = {
	type: string
	uid: string
}

type ClickHouseTargetFormat = "table" | "time_series"

const createDatasource = (binding: DatasourceBinding): DatasourceReference => ({
	type: binding.type,
	uid: binding.uid
})

const createTarget = ({
	panel,
	sql,
	binding
}: {
	panel: DashboardPanel
	sql: string
	binding: DatasourceBinding
}) => {
	const format: ClickHouseTargetFormat = panel.panelType === "timeseries" ? "time_series" : "table"

	return {
		datasource: createDatasource(binding),
		refId: "A",
		query: sql,
		format,
		editorMode: "sql",
		datasourceMode: "Datasource",
		extrapolate: false,
		rawQuery: "",
		adHocFilters: [],
		showHelp: false,
		showFormattedSQL: false,
		nullifySparse: false,
		dateTimeType: "DATETIME",
		dateTimeColDataType: "timestamp",
		dateColDataType: "",
		round: "0s",
		intervalFactor: 1,
		interval: "1m",
		database: "default",
		table: "",
		skip_comments: false,
		add_metadata: false,
		useWindowFuncForMacros: false
	}
}

const createPanel = ({
	panel,
	sql,
	binding
}: {
	panel: DashboardPanel
	sql: string
	binding: DatasourceBinding
}) => {
	const datasource = createDatasource(binding)

	if (panel.panelType === "timeseries") {
		return {
			id: panel.id,
			title: panel.title,
			description: panel.description,
			type: "timeseries",
			datasource,
			gridPos: panel.gridPos,
			fieldConfig: {
				defaults: {
					color: { mode: "palette-classic" },
					custom: {
						drawStyle: "line",
						fillOpacity: 10,
						lineInterpolation: "linear",
						lineWidth: 2,
						pointSize: 3,
						scaleDistribution: { type: "linear" },
						showPoints: "never",
						spanNulls: true,
						stacking: { group: "A", mode: "none" }
					}
				},
				overrides: []
			},
			options: {
				legend: {
					calcs: ["lastNotNull"],
					displayMode: "table",
					placement: "bottom"
				},
				tooltip: {
					mode: "multi",
					sort: "desc"
				}
			},
			targets: [createTarget({ panel, sql, binding })]
		}
	}

	return {
		id: panel.id,
		title: panel.title,
		description: panel.description,
		type: "table",
		datasource,
		gridPos: panel.gridPos,
		fieldConfig: {
			defaults: {},
			overrides: []
		},
		options: {
			cellHeight: "sm",
			showHeader: true
		},
		targets: [createTarget({ panel, sql, binding })]
	}
}

const createDashboard = async ({ binding }: { binding: DatasourceBinding }) => {
	const renderedPanels = await Promise.all(
		dashboardPanels.map(async (panel) => {
			const template = await loadQueryTemplate(
				resolve(OBSERVABILITY_ROOT, "analytics-engine/sql", panel.queryFile)
			)
			const sql = renderQueryTemplate({
				template,
				mode: "grafana" satisfies RenderMode,
				dataset: resolveAeDataset()
			})

			return createPanel({ panel, sql, binding })
		})
	)

	return {
		__requires: [
			{ id: "grafana", name: "Grafana", type: "grafana", version: "11.0.0" },
			{
				id: binding.type,
				name: GRAFANA_CLICKHOUSE_DATASOURCE_NAME,
				type: "datasource",
				version: "4.0.6"
			},
			{ id: "table", name: "Table", type: "panel", version: "11.0.0" },
			{ id: "timeseries", name: "Time series", type: "panel", version: "11.0.0" }
		],
		annotations: {
			list: [
				{
					builtIn: 1,
					datasource: "-- Grafana --",
					enable: true,
					hide: true,
					iconColor: "rgba(0, 211, 255, 1)",
					name: "Annotations & Alerts",
					type: "dashboard"
				}
			]
		},
		editable: true,
		fiscalYearStartMonth: 0,
		graphTooltip: 0,
		id: null,
		links: [],
		liveNow: false,
		panels: renderedPanels,
		refresh: "5m",
		schemaVersion: 39,
		tags: ["bridge-ui", "cloudflare", "analytics-engine"],
		templating: { list: [] },
		time: { from: "now-7d", to: "now" },
		timepicker: {},
		timezone: "browser",
		title: "Bridge UI Analytics",
		uid: "bridge-ui-analytics",
		version: 1,
		weekStart: ""
	}
}

const run = async () => {
	const args = parseCliArgs(process.argv.slice(2))
	const requestedOutputPath = readStringArg(args, "output", defaultOutputPath) ?? defaultOutputPath
	const binding = {
		uid:
			readStringArg(args, "datasource-uid", resolveGrafanaDatasourceUid()) ??
			resolveGrafanaDatasourceUid(),
		type:
			readStringArg(args, "datasource-type", resolveGrafanaDatasourceType()) ??
			resolveGrafanaDatasourceType()
	}
	const outputPath = isAbsolute(requestedOutputPath)
		? requestedOutputPath
		: resolve(process.cwd(), requestedOutputPath)
	const dashboard = await createDashboard({ binding })

	await mkdir(dirname(outputPath), { recursive: true })
	await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8")
	console.log(`wrote ${outputPath}`)
}

await run()
