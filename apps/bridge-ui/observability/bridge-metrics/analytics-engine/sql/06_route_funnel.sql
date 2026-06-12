-- title: Route funnel
-- description: Lifecycle counts and completion ratio grouped by source, destination, and direction.
-- default_window: 7d
SELECT
  blob4 AS source,
  blob5 AS destination,
  if(
    startsWith(blob4, 'mina:'),
    'deposit',
    if(
      blob4 IN (
        'zeko:testnet',
        'zeko:mainnet',
        'zeko:zeko-mainnet',
        'zeko-m:testnet',
        'zeko-m:mainnet',
        'zeko-e:testnet',
        'zeko-e:mainnet'
      ),
      'withdrawal',
      'unknown'
    )
  ) AS direction,
  sumIf(_sample_interval, blob2 = 'started') AS started,
  sumIf(_sample_interval, blob2 = 'completed') AS completed,
  sumIf(_sample_interval, blob2 = 'failed') AS failed,
  sumIf(_sample_interval, blob2 = 'canCancel') AS can_cancel,
  if(
    sumIf(_sample_interval, blob2 = 'started') = 0,
    0.0,
    100.0 * sumIf(_sample_interval, blob2 = 'completed')
      / sumIf(_sample_interval, blob2 = 'started')
  ) AS completion_pct
FROM {{dataset}}
WHERE {{time_filter:7d}}
  AND blob1 = 'bridge_operation'
GROUP BY source, destination, direction
ORDER BY started DESC
