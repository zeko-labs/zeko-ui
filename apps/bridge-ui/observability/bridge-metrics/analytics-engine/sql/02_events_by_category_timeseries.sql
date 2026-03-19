-- title: Events by category over time
-- description: Hourly weighted event totals split by bridge metric category.
-- default_window: 7d
SELECT
  toDateTime(intDiv(toUInt32(timestamp), 3600) * 3600) AS time,
  blob1 AS category,
  SUM(_sample_interval) AS events
FROM {{dataset}}
WHERE {{time_filter:7d}}
GROUP BY time, category
ORDER BY time, category

