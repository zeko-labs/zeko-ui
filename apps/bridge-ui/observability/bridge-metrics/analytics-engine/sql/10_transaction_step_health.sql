-- title: Transaction step health
-- description: Weighted counts, success/failure totals, and average latency for transaction-machine steps.
-- default_window: 7d
SELECT
  blob2 AS action,
  SUM(_sample_interval) AS events,
  sumIf(_sample_interval, double3 = 1.0) AS succeeded,
  sumIf(_sample_interval, double3 = 0.0) AS failed,
  if(
    SUM(_sample_interval) = 0,
    0.0,
    SUM(double1 * _sample_interval) / SUM(_sample_interval)
  ) AS avg_duration_ms
FROM {{dataset}}
WHERE {{time_filter:7d}}
  AND blob1 = 'transaction'
GROUP BY action
ORDER BY events DESC
