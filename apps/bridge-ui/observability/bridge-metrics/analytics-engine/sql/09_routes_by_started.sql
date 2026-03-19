-- title: Routes by started events
-- description: Weighted start volume by source, destination, and direction to identify the most-used bridge routes.
-- default_window: 30d
SELECT
  blob4 AS source,
  blob5 AS destination,
  blob3 AS direction,
  SUM(_sample_interval) AS started_events
FROM {{dataset}}
WHERE {{time_filter:30d}}
  AND blob1 = 'bridge_operation'
  AND blob2 = 'started'
GROUP BY source, destination, direction
ORDER BY started_events DESC

