-- Wingman Premium Subscription Schema
-- Run this in your Supabase SQL Editor after the initial schema

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
-- Tracks Premium subscription status for users
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- References the license.id (user's license record)
    license_key VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, cancelled, expired, past_due
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing')),
    CONSTRAINT fk_license FOREIGN KEY (user_id) REFERENCES licenses(id) ON DELETE CASCADE
);

-- ============================================
-- API USAGE TABLE
-- ============================================
-- Tracks AI token usage per user per month
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- References the license.id
    month VARCHAR(7) NOT NULL,  -- YYYY-MM format (e.g., '2024-01')
    tokens_used BIGINT DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    last_request_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint for one record per user per month
    CONSTRAINT unique_user_month UNIQUE (user_id, month),
    CONSTRAINT fk_license_usage FOREIGN KEY (user_id) REFERENCES licenses(id) ON DELETE CASCADE
);

-- ============================================
-- WEBHOOK EVENTS LOG TABLE
-- ============================================
-- Logs all Stripe webhook events for debugging
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_license_key ON subscriptions(license_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- API usage indexes - critical for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_user_month ON api_usage(user_id, month);
CREATE INDEX IF NOT EXISTS idx_api_usage_month ON api_usage(month);

-- Webhook events index
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- ============================================
-- TRIGGERS
-- ============================================
-- Auto-update updated_at for subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for api_usage
DROP TRIGGER IF EXISTS update_api_usage_updated_at ON api_usage;
CREATE TRIGGER update_api_usage_updated_at
    BEFORE UPDATE ON api_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if a subscription is currently active
-- Takes into account cancelled subscriptions that haven't expired yet
CREATE OR REPLACE FUNCTION is_subscription_active(p_license_key VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM subscriptions s
        WHERE s.license_key = p_license_key
        AND (
            -- Active subscription
            s.status = 'active'
            OR
            -- Cancelled but still within the paid period
            (s.status = 'cancelled' AND s.current_period_end > NOW())
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get current month's token usage for a user
CREATE OR REPLACE FUNCTION get_monthly_token_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_tokens BIGINT;
    v_current_month VARCHAR(7);
BEGIN
    v_current_month := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');

    SELECT COALESCE(tokens_used, 0)
    INTO v_tokens
    FROM api_usage
    WHERE user_id = p_user_id
    AND month = v_current_month;

    RETURN COALESCE(v_tokens, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to increment token usage atomically
CREATE OR REPLACE FUNCTION increment_token_usage(
    p_user_id UUID,
    p_tokens BIGINT
)
RETURNS TABLE (
    new_tokens_used BIGINT,
    request_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_month VARCHAR(7);
BEGIN
    v_current_month := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');

    -- Upsert: insert if not exists, update if exists
    INSERT INTO api_usage (user_id, month, tokens_used, request_count, last_request_at)
    VALUES (p_user_id, v_current_month, p_tokens, 1, NOW())
    ON CONFLICT (user_id, month)
    DO UPDATE SET
        tokens_used = api_usage.tokens_used + p_tokens,
        request_count = api_usage.request_count + 1,
        last_request_at = NOW(),
        updated_at = NOW()
    RETURNING api_usage.tokens_used, api_usage.request_count
    INTO new_tokens_used, request_count;

    RETURN NEXT;
END;
$$;

-- Function to check if user has Premium access
-- Returns true if:
-- 1. User has an active Premium subscription, OR
-- 2. User has/had a Premium subscription (grants Pro access)
CREATE OR REPLACE FUNCTION has_premium_access(p_license_key VARCHAR)
RETURNS TABLE (
    has_access BOOLEAN,
    tier VARCHAR,
    is_active BOOLEAN,
    tokens_used BIGINT,
    tokens_remaining BIGINT,
    current_period_end TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_license_active BOOLEAN;
    v_has_subscription BOOLEAN;
    v_sub_status VARCHAR;
    v_period_end TIMESTAMP WITH TIME ZONE;
    v_tokens_used BIGINT;
    v_current_month VARCHAR(7);
    v_token_limit BIGINT := 1000000;  -- 1 million tokens
BEGIN
    v_current_month := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');

    -- Get user info from licenses table
    SELECT l.id, l.is_active
    INTO v_user_id, v_license_active
    FROM licenses l
    WHERE l.license_key = p_license_key;

    -- If no license found, no access
    IF v_user_id IS NULL THEN
        has_access := FALSE;
        tier := 'none';
        is_active := FALSE;
        tokens_used := 0;
        tokens_remaining := 0;
        current_period_end := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check for Premium subscription
    SELECT s.status, s.current_period_end
    INTO v_sub_status, v_period_end
    FROM subscriptions s
    WHERE s.user_id = v_user_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- Get current token usage
    SELECT COALESCE(au.tokens_used, 0)
    INTO v_tokens_used
    FROM api_usage au
    WHERE au.user_id = v_user_id
    AND au.month = v_current_month;

    v_tokens_used := COALESCE(v_tokens_used, 0);

    -- Determine access level
    IF v_sub_status IS NOT NULL THEN
        -- Has a subscription record
        IF v_sub_status = 'active' OR (v_sub_status = 'cancelled' AND v_period_end > NOW()) THEN
            -- Active Premium subscription
            has_access := TRUE;
            tier := 'premium';
            is_active := TRUE;
            tokens_used := v_tokens_used;
            tokens_remaining := GREATEST(v_token_limit - v_tokens_used, 0);
            current_period_end := v_period_end;
        ELSE
            -- Had Premium subscription (now expired) - grant Pro access
            has_access := TRUE;
            tier := 'pro';
            is_active := FALSE;  -- Subscription not active
            tokens_used := v_tokens_used;
            tokens_remaining := 0;  -- No AI access without active subscription
            current_period_end := v_period_end;
        END IF;
    ELSIF v_license_active THEN
        -- Regular Pro license (one-time purchase)
        has_access := TRUE;
        tier := 'pro';
        is_active := TRUE;
        tokens_used := 0;
        tokens_remaining := 0;  -- Pro doesn't have AI access
        current_period_end := NULL;
    ELSE
        -- Inactive license
        has_access := FALSE;
        tier := 'free';
        is_active := FALSE;
        tokens_used := 0;
        tokens_remaining := 0;
        current_period_end := NULL;
    END IF;

    RETURN NEXT;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for edge functions)
CREATE POLICY "Service role has full access to subscriptions"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to api_usage"
    ON api_usage FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to webhook_events"
    ON webhook_events FOR ALL
    USING (auth.role() = 'service_role');

-- Allow anon to read subscription status (needed for client validation)
CREATE POLICY "Anon can read subscriptions"
    ON subscriptions FOR SELECT
    USING (true);

CREATE POLICY "Anon can read api_usage"
    ON api_usage FOR SELECT
    USING (true);

-- ============================================
-- UPDATE LICENSES TABLE
-- ============================================
-- Add tier column if it doesn't exist with 'premium' option
-- Note: This might already exist but we ensure it supports the new tier
ALTER TABLE licenses
    DROP CONSTRAINT IF EXISTS licenses_tier_check;

ALTER TABLE licenses
    ADD CONSTRAINT licenses_tier_check
    CHECK (tier IN ('free', 'pro', 'premium'));
