-- Security monitoring queries for Wingman
-- Run these in Supabase SQL editor or wire into dashboards/alerts.

-- 1) Failed webhook processing in the last 24h
SELECT
  event_type,
  COUNT(*) AS failed_count
FROM webhook_events
WHERE processed = false
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY failed_count DESC;

-- 2) Top rate-limited identifiers in the last 24h
SELECT
  endpoint,
  identifier,
  attempts,
  window_start
FROM rate_limiting
WHERE window_start >= NOW() - INTERVAL '24 hours'
  AND attempts >= 5
ORDER BY attempts DESC, window_start DESC
LIMIT 100;

-- 3) Current month token outliers
SELECT
  month,
  user_id,
  tokens_used,
  request_count,
  last_request_at
FROM api_usage
WHERE month = TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
ORDER BY tokens_used DESC
LIMIT 50;

-- 4) Licenses with unusually high device churn in 24h
SELECT
  l.email,
  da.license_id,
  COUNT(*) AS activation_events
FROM device_activations da
JOIN licenses l ON l.id = da.license_id
WHERE da.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY l.email, da.license_id
HAVING COUNT(*) >= 3
ORDER BY activation_events DESC;
