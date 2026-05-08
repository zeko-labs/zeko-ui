-- title: Fee retry trend
-- description: Hourly weighted volume of transaction fee retry events.
-- default_window: 14d
SELECT
  toDateTime(intDiv(toUInt32(timestamp), 3600) * 3600) AS time,
  SUM(_sample_interval) AS fee_retry_events
FROM {{dataset}}
WHERE {{time_filter:14d}}
  AND blob1 = 'transaction'
  AND blob2 = 'feeRetry'
GROUP BY time
ORDER BY time
