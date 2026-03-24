-- title: Events by action over time
-- description: Hourly weighted event totals split by concrete bridge action name.
-- default_window: 7d
SELECT
  toDateTime(intDiv(toUInt32(timestamp), 3600) * 3600) AS time,
  blob2 AS action,
  SUM(_sample_interval) AS events
FROM {{dataset}}
WHERE {{time_filter:7d}}
GROUP BY time, action
ORDER BY time, action

