-- Wingman Security Fixes
-- Run this in your Supabase SQL Editor to apply security patches

-- ============================================
-- 1. RATE LIMITING TABLE
-- ============================================
-- Tracks API request attempts to prevent brute force attacks
CREATE TABLE IF NOT EXISTS rate_limiting (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL,  -- IP address, license key, or combination
    endpoint VARCHAR(100) NOT NULL,     -- validate-license, deactivate-device, etc.
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint for one record per identifier+endpoint per window
    CONSTRAINT unique_identifier_endpoint UNIQUE (identifier, endpoint)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limiting_identifier_endpoint
    ON rate_limiting(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limiting_window_start
    ON rate_limiting(window_start);

-- ============================================
-- 2. RATE LIMITING FUNCTION
-- ============================================
-- Check if a request should be rate limited
-- Returns: TRUE if rate limit exceeded, FALSE if allowed
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier VARCHAR,
    p_endpoint VARCHAR,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_attempts INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_cutoff TIMESTAMP WITH TIME ZONE;
BEGIN
    v_cutoff := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Get current attempts within window
    SELECT attempts, window_start
    INTO v_attempts, v_window_start
    FROM rate_limiting
    WHERE identifier = p_identifier
    AND endpoint = p_endpoint;

    -- If no record exists or window expired, allow and create/reset
    IF v_attempts IS NULL OR v_window_start < v_cutoff THEN
        INSERT INTO rate_limiting (identifier, endpoint, attempts, window_start)
        VALUES (p_identifier, p_endpoint, 1, NOW())
        ON CONFLICT (identifier, endpoint)
        DO UPDATE SET
            attempts = 1,
            window_start = NOW();
        RETURN FALSE;  -- Allow request
    END IF;

    -- If within window, check limit
    IF v_attempts >= p_max_attempts THEN
        RETURN TRUE;  -- Rate limit exceeded
    END IF;

    -- Increment attempts
    UPDATE rate_limiting
    SET attempts = attempts + 1
    WHERE identifier = p_identifier
    AND endpoint = p_endpoint;

    RETURN FALSE;  -- Allow request
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. CLEANUP FUNCTION FOR OLD RATE LIMIT RECORDS
-- ============================================
-- Remove rate limit records older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limiting
    WHERE window_start < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. FIX RLS POLICIES - REMOVE ANONYMOUS ACCESS
-- ============================================
-- WARNING: This removes the dangerous anonymous SELECT policies
-- Your edge functions will continue working because they use service_role

-- Drop dangerous anonymous policies on licenses
DROP POLICY IF EXISTS "Anon can validate licenses" ON licenses;

-- Drop dangerous anonymous policies on device_activations
DROP POLICY IF EXISTS "Anon can read device activations" ON device_activations;

-- Drop dangerous anonymous policies on subscriptions
DROP POLICY IF EXISTS "Anon can read subscriptions" ON subscriptions;

-- Drop dangerous anonymous policies on api_usage
DROP POLICY IF EXISTS "Anon can read api_usage" ON api_usage;

-- Service role policies remain intact (these already exist and allow edge functions to work)
-- No changes needed - service_role still has full access

-- ============================================
-- 5. RLS FOR RATE LIMITING TABLE
-- ============================================
ALTER TABLE rate_limiting ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to rate_limiting"
    ON rate_limiting FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the security fixes are applied:

-- 1. Check RLS is enabled on all tables
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('licenses', 'device_activations', 'subscriptions', 'api_usage', 'rate_limiting');

-- 2. Check policies (should only see service_role policies, no anon SELECT policies)
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('licenses', 'device_activations', 'subscriptions', 'api_usage', 'rate_limiting')
-- ORDER BY tablename, policyname;

-- 3. Test rate limiting function
-- SELECT check_rate_limit('test-ip', 'test-endpoint', 5, 1);  -- Should return FALSE (allowed)
-- SELECT check_rate_limit('test-ip', 'test-endpoint', 5, 1);  -- Run 6 times total, last one should return TRUE (blocked)
