-- title: Smoke test dataset health
-- description: Validates that the dataset is queryable and returns freshness metadata for the selected time range.
-- default_window: 30d
SELECT
  SUM(_sample_interval) AS total_events_in_window,
  COUNT() AS sampled_rows_in_window,
  MIN(timestamp) AS first_seen_at,
  MAX(timestamp) AS last_seen_at
FROM {{dataset}}
WHERE {{time_filter:30d}}

