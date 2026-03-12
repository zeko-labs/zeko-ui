-- title: Error labels
-- description: Weighted counts for recorded metric labels that represent bridge failures or synthetic failed lifecycle events.
-- default_window: 7d
SELECT
  blob1 AS category,
  blob2 AS action,
  blob3 AS label,
  SUM(_sample_interval) AS occurrences
FROM {{dataset}}
WHERE {{time_filter:7d}}
  AND blob3 != ''
  AND (
    double3 = 0.0
    OR (blob1 = 'bridge_operation' AND blob2 = 'failed')
  )
GROUP BY category, action, label
ORDER BY occurrences DESC
LIMIT 50

