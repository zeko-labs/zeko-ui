-- title: Failure rate by action
-- description: Weighted success and failure rates for actions that report explicit outcome values.
-- default_window: 7d
SELECT
  blob1 AS category,
  blob2 AS action,
  sumIf(_sample_interval, double3 = 1.0) AS succeeded,
  sumIf(_sample_interval, double3 = 0.0) AS failed,
  sumIf(_sample_interval, double3 = 1.0 OR double3 = 0.0) AS total_with_outcome,
  if(
    sumIf(_sample_interval, double3 = 1.0 OR double3 = 0.0) = 0,
    0.0,
    100.0 * sumIf(_sample_interval, double3 = 0.0)
      / sumIf(_sample_interval, double3 = 1.0 OR double3 = 0.0)
  ) AS failure_pct
FROM {{dataset}}
WHERE {{time_filter:7d}}
  AND double1 > 0
GROUP BY category, action
HAVING total_with_outcome > 0
ORDER BY failure_pct DESC, failed DESC
