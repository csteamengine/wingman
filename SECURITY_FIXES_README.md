# Security Fixes Applied

## Overview

All critical security vulnerabilities have been fixed. This document explains what was fixed and how to deploy the changes.

## What Was Fixed

### 🔴 Critical Issues (Fixed)

1. **Database Anonymous Access Removed** ✅
   - Removed dangerous RLS policies that allowed anyone to query all licenses, devices, subscriptions, and API usage
   - Only edge functions (using service role) can now access the database
   - Users can no longer query Supabase directly using the publishable key

2. **Rate Limiting Implemented** ✅
   - `validate-license`: Max 10 attempts per IP per minute + 5 failed attempts per license key per hour
   - `deactivate-device`: Max 10 attempts per IP per hour + 5 attempts per license per hour
   - `claude-proxy`: Max 30 requests per IP per minute (in addition to token-based limiting)
   - Prevents brute force attacks on license keys and spam abuse

3. **XSS Sanitization Removed** ✅
   - Removed ineffective `<script>` tag sanitization in claude-proxy
   - Replaced with simple trim validation
   - XSS not a risk since prompts go to Claude API, not rendered in browser

## Files Changed

### 1. New File: `supabase/security-fixes.sql`
SQL migration that:
- Creates `rate_limiting` table for tracking request attempts
- Adds `check_rate_limit()` function for rate limiting logic
- Removes dangerous anonymous RLS policies
- Adds cleanup function for old rate limit records

### 2. Updated: `supabase/functions/validate-license/index.ts`
- Added IP-based rate limiting (10 requests/minute)
- Added license-key-based rate limiting (5 failed attempts/hour)
- Returns 429 status when rate limited

### 3. Updated: `supabase/functions/deactivate-device/index.ts`
- Added IP-based rate limiting (10 requests/hour)
- Added license-key-based rate limiting (5 requests/hour)
- Returns 429 status when rate limited

### 4. Updated: `supabase/functions/claude-proxy/index.ts`
- Added IP-based rate limiting (30 requests/minute)
- Removed ineffective XSS sanitization
- Better error handling for rate limits

## Deployment Instructions

### Step 1: Apply Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open and run the file: `supabase/security-fixes.sql`
4. Verify success by checking the output

### Step 2: Deploy Edge Functions

**IMPORTANT:** Make sure you redeploy ALL three edge functions to get the fixes:

```bash
# From your project root
supabase functions deploy validate-license
supabase functions deploy deactivate-device
supabase functions deploy claude-proxy
```

Or deploy all at once:

```bash
supabase functions deploy
```

**Note:** If you get module loading errors after deployment, wait 2-3 minutes for the edge runtime to fully refresh, then try your app again.

### Step 3: Verify Security Fixes

Run these SQL queries in Supabase SQL Editor to verify:

#### Check RLS is enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('licenses', 'device_activations', 'subscriptions', 'api_usage', 'rate_limiting');
```
All should show `rowsecurity = true`

#### Check policies (no anonymous SELECT):
```sql
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('licenses', 'device_activations', 'subscriptions', 'api_usage')
ORDER BY tablename;
```
Should only see policies for `service_role`, NOT for anonymous users.

#### Test rate limiting:
```sql
-- Should return FALSE (allowed)
SELECT check_rate_limit('test-ip', 'test-endpoint', 3, 1);

-- Run this 4 times total - the 4th should return TRUE (blocked)
SELECT check_rate_limit('test-ip', 'test-endpoint', 3, 1);
```

### Step 4: Monitor for Issues

After deployment, monitor your Supabase logs for:
- Any rate limiting triggers (429 errors)
- Legitimate users being blocked (adjust limits if needed)
- Failed authentication attempts

## Rate Limit Configuration

If you need to adjust rate limits, modify these values in the edge function code:

**validate-license:**
- IP limit: 10 requests/minute (line ~36)
- License limit: 5 failed attempts/hour (line ~53)

**deactivate-device:**
- IP limit: 10 requests/hour (line ~36)
- License limit: 5 requests/hour (line ~53)

**claude-proxy:**
- IP limit: 30 requests/minute (line ~121)
- Token limit: 1M tokens/month (hardcoded in database function)

## Cleanup

To remove old rate limit records (optional cron job):

```sql
-- Run daily to clean up records older than 24 hours
SELECT cleanup_old_rate_limits();
```

You can set up a Supabase cron job or run this manually periodically.

## What to Do Next

1. **Apply the database migration** (security-fixes.sql)
2. **Deploy the edge functions**
3. **Test your app** to ensure everything works
4. **Monitor logs** for the first 24 hours
5. Consider setting up automated cleanup of old rate limit records

## Security Best Practices Going Forward

- ✅ Never add RLS policies with `USING (true)` for anonymous users
- ✅ Always validate inputs on the server side
- ✅ Use rate limiting for public endpoints
- ✅ Keep secrets in environment variables (never hardcode)
- ✅ Monitor logs for unusual activity
- ✅ Regularly audit RLS policies

## Questions?

If you experience any issues after deployment:
1. Check Supabase function logs for errors
2. Verify the SQL migration completed successfully
3. Test rate limiting with the verification queries above
4. Check that edge functions deployed correctly

The security fixes are backwards compatible - your existing app will continue working without any client-side changes needed.
