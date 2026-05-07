export type DashboardPanel = {
	id: number
	title: string
	description: string
	panelType: "table" | "timeseries"
	queryType: "table" | "timeSeriesQuery"
	queryFile: string
	gridPos: { h: number; w: number; x: number; y: number }
}

export const dashboardPanels: DashboardPanel[] = [
	{
		id: 1,
		title: "Overview stats",
		description: "Dataset freshness and event volume for the selected time range.",
		panelType: "table",
		queryType: "table",
		queryFile: "00_smoke_dataset.sql",
		gridPos: { h: 7, w: 24, x: 0, y: 0 }
	},
	{
		id: 2,
		title: "Events by category",
		description: "Hourly weighted event volume by bridge metric category.",
		panelType: "timeseries",
		queryType: "timeSeriesQuery",
		queryFile: "02_events_by_category_timeseries.sql",
		gridPos: { h: 9, w: 12, x: 0, y: 7 }
	},
	{
		id: 3,
		title: "Events by action",
		description: "Hourly weighted event volume by bridge action.",
		panelType: "timeseries",
		queryType: "timeSeriesQuery",
		queryFile: "03_events_by_action_timeseries.sql",
		gridPos: { h: 9, w: 12, x: 12, y: 7 }
	},
	{
		id: 4,
		title: "Latency by action",
		description: "Weighted duration percentiles for timed bridge operations.",
		panelType: "table",
		queryType: "table",
		queryFile: "04_latency_by_action.sql",
		gridPos: { h: 10, w: 12, x: 0, y: 16 }
	},
	{
		id: 5,
		title: "Failure rate by action",
		description: "Weighted failure rate for actions that emit explicit outcomes.",
		panelType: "table",
		queryType: "table",
		queryFile: "05_failure_rate_by_action.sql",
		gridPos: { h: 10, w: 12, x: 12, y: 16 }
	},
	{
		id: 6,
		title: "Route funnel",
		description: "Lifecycle counts and completion ratios grouped by route and inferred direction.",
		panelType: "table",
		queryType: "table",
		queryFile: "06_route_funnel.sql",
		gridPos: { h: 10, w: 12, x: 0, y: 26 }
	},
	{
		id: 7,
		title: "Top error labels",
		description: "Highest-volume recorded bridge error labels in the selected range.",
		panelType: "table",
		queryType: "table",
		queryFile: "07_error_labels.sql",
		gridPos: { h: 10, w: 12, x: 12, y: 26 }
	},
	{
		id: 9,
		title: "Routes by started events",
		description: "Most frequently started bridge routes in the selected range.",
		panelType: "table",
		queryType: "table",
		queryFile: "09_routes_by_started.sql",
		gridPos: { h: 8, w: 12, x: 12, y: 36 }
	}
]
