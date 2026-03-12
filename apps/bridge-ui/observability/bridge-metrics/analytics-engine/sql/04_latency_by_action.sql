-- title: Latency by action
-- description: Weighted latency percentiles for act()-based bridge operations.
-- default_window: 7d
SELECT
  blob1 AS category,
  blob2 AS action,
  SUM(_sample_interval) AS events,
  SUM(double1 * _sample_interval) / SUM(_sample_interval) AS avg_duration_ms,
  quantileExactWeighted(0.50)(double1, _sample_interval) AS p50_duration_ms,
  quantileExactWeighted(0.95)(double1, _sample_interval) AS p95_duration_ms
FROM {{dataset}}
WHERE {{time_filter:7d}}
  AND double1 > 0
GROUP BY category, action
ORDER BY p95_duration_ms DESC

