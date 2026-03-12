import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { dashboardPanels, type DashboardPanel } from "../dashboard-manifest.ts"
import { loadQueryTemplate, renderQueryTemplate } from "../../lib/sql.ts"
import {
	BRIDGE_UI_ROOT,
	GRAFANA_CLICKHOUSE_DATASOURCE_TYPE,
	GRAFANA_IMPORT_DATASOURCE_NAME,
	OBSERVABILITY_ROOT,
	parseCliArgs,
	readStringArg,
	resolveAeDataset,
	type RenderMode
} from "../../lib/runtime.ts"

const defaultOutputPath = resolve(OBSERVABILITY_ROOT, "grafana/bridge-ui.analytics.dashboard.json")

const createDatasource = () => `\${${GRAFANA_IMPORT_DATASOURCE_NAME}}`

const createTarget = ({
	panel,
	sql
}: {
	panel: DashboardPanel
	sql: string
}) => ({
	datasource: createDatasource(),
	editorType: "sql",
	format: 1,
	meta: {
		builderOptions: {
			columns: [],
			database: "",
			limit: 1000,
			mode: "list",
			queryType: panel.queryType,
			table: ""
		}
	},
	queryType: panel.queryType,
	rawSql: sql,
	refId: "A"
})

const createPanel = ({
	panel,
	sql
}: {
	panel: DashboardPanel
	sql: string
}) => {
	const datasource = createDatasource()

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
			targets: [createTarget({ panel, sql })]
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
		targets: [createTarget({ panel, sql })]
	}
}

const createDashboard = async () => {
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

			return createPanel({ panel, sql })
		})
	)

	return {
		__inputs: [
			{
				name: GRAFANA_IMPORT_DATASOURCE_NAME,
				label: "Bridge metrics datasource",
				description: "Altinity ClickHouse datasource configured for Cloudflare Analytics Engine",
				type: "datasource",
				pluginId: GRAFANA_CLICKHOUSE_DATASOURCE_TYPE,
				pluginName: "Altinity ClickHouse datasource"
			}
		],
		__requires: [
			{ id: "grafana", name: "Grafana", type: "grafana", version: "11.0.0" },
			{
				id: GRAFANA_CLICKHOUSE_DATASOURCE_TYPE,
				name: "Altinity ClickHouse datasource",
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
	const outputPath = resolve(BRIDGE_UI_ROOT, requestedOutputPath)
	const dashboard = await createDashboard()

	await mkdir(dirname(outputPath), { recursive: true })
	await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8")
	console.log(`wrote ${outputPath}`)
}

await run()
