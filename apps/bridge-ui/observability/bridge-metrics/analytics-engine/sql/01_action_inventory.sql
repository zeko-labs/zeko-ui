-- title: Action inventory
-- description: Weighted event counts by metric category and action, including direct lifecycle events and timed act() operations.
-- default_window: 7d
SELECT
  blob1 AS category,
  blob2 AS action,
  SUM(_sample_interval) AS events,
  sumIf(_sample_interval, double1 > 0) AS timed_events,
  sumIf(_sample_interval, double3 = 0.0 OR double3 = 1.0) AS outcome_events
FROM {{dataset}}
WHERE {{time_filter:7d}}
GROUP BY category, action
ORDER BY events DESC, category, action

