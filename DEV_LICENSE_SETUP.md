# Dev License Setup Guide

This guide explains how to set up and use development licenses for Wingman QA testing.

## Overview

Dev licenses are special licenses that:
- Enable the dev tier switcher in the production app (normally only visible in dev mode)
- Allow QA testers to switch between Free/Pro/Premium tiers for testing
- Work exactly like regular licenses but with the `is_dev` flag set to `true`

## Setup

### 1. Set the Secret Environment Variable in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - **Name**: `DEV_LICENSE_SECRET`
   - **Value**: A secure random string (e.g., generate with `openssl rand -hex 32`)
   - Keep this secret safe - it's the only thing protecting dev license creation!

### 2. Deploy the Edge Function

```bash
# From the project root
supabase functions deploy create-dev-license
```

### 3. Apply the Database Migration

Run the migration to add the `is_dev` column to the licenses table:

```bash
# Option 1: Using Supabase CLI
supabase db push

# Option 2: Manually in SQL Editor
# Copy and paste the contents of supabase/migrations/add_is_dev_column.sql
```

Alternatively, if you're setting up a fresh database, the column is already included in `supabase/schema.sql`.

## Creating Dev Licenses

When you create a dev license, **an email is automatically sent** to the QA tester with:
- Their license key
- Activation instructions
- How to use the dev tier switcher
- Testing guidelines

### Using cURL

```bash
curl -X POST \
  https://yhpetdqcmqpfwhdtbhat.supabase.co/functions/v1/create-dev-license \
  -H "apikey: sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "qa-tester@example.com",
    "tier": "pro",
    "max_devices": 3,
    "secret": "YOUR_DEV_LICENSE_SECRET_HERE"
  }'
```

**Note:** The email will be sent from `noreply@wingman-dev.app` via Resend. Make sure `RESEND_API_KEY` is configured in your Supabase Edge Functions secrets.

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `email` | string | ✅ | - | Email address for the dev license |
| `tier` | string | ❌ | `"pro"` | License tier: `"pro"` or `"premium"` |
| `max_devices` | number | ❌ | `3` | Maximum number of devices |
| `secret` | string | ✅ | - | Your `DEV_LICENSE_SECRET` value |

### Response

**Success (200):**
```json
{
  "success": true,
  "license_key": "ABCD-EFGH-IJKL-MNOP",
  "email": "qa-tester@example.com",
  "tier": "pro",
  "max_devices": 3,
  "is_dev": true,
  "email_sent": true,
  "message": "Dev license created and emailed successfully"
}
```

If the email fails to send, `email_sent` will be `false` and the message will indicate the failure. The license will still be created and usable.

**Error (401 - Invalid Secret):**
```json
{
  "error": "Unauthorized: Invalid secret"
}
```

**Error (400 - Missing Email):**
```json
{
  "error": "Missing required field: email"
}
```

## Using Dev Licenses

### For QA Testers

1. **Check Your Email**
   - You'll receive an email at the address used to create the license
   - Subject: "Your Wingman Dev/QA License Key"
   - The email contains your license key and full instructions

2. **Activate the License**
   - Open Wingman
   - Go to Settings → License & Updates
   - Enter the license key and email from the email
   - Click "Activate License"

3. **Access the Tier Switcher**
   - After activation, look for the orange "Dev" pill in the top-right corner of the app
   - Click the tier buttons (Free/Pro/Premium) to test different feature sets
   - Click "Real" to return to the actual license tier

4. **Testing Features**
   - Switch to **Free**: All Pro features should be locked
   - Switch to **Pro**: All Pro features should be unlocked
   - Switch to **Premium**: Pro features + AI features should be unlocked
   - Switch to **Real**: Returns to the tier specified in the license (usually Pro)

### Important Notes

- Dev licenses work on production builds (not just development mode)
- The tier switcher is **only visible** to users with dev licenses or in dev mode
- Dev licenses count against device limits just like regular licenses
- Dev licenses can be deactivated normally through Settings

## Security Considerations

1. **Protect the Secret**
   - Never commit `DEV_LICENSE_SECRET` to git
   - Only share with trusted developers
   - Rotate the secret if it's compromised

2. **Monitor Dev Licenses**
   - Dev licenses are marked with `is_dev = true` in the database
   - You can query them: `SELECT * FROM licenses WHERE is_dev = true`

3. **Deactivate When Done**
   - Remove dev licenses from the database when QA is complete
   - Or mark them as inactive: `UPDATE licenses SET is_active = false WHERE is_dev = true`

## Troubleshooting

### "Dev license creation not configured"
- Make sure `DEV_LICENSE_SECRET` is set in Supabase Edge Functions secrets
- Redeploy the edge function after setting the secret

### Tier switcher not showing
- Verify the license was activated successfully
- Check that `is_dev = true` in the database:
  ```sql
  SELECT license_key, email, is_dev FROM licenses WHERE email = 'qa-tester@example.com';
  ```
- Try restarting the app

### Email not received
- Check spam/junk folder
- Verify `RESEND_API_KEY` is set in Supabase Edge Functions secrets
- Check the function logs in Supabase for email errors
- The license is still created even if email fails - you can manually share the license key

### License activation failed
- Ensure the email matches exactly (case-insensitive)
- Check device limit hasn't been exceeded
- Verify the license is marked as active in the database

## Database Queries

### List all dev licenses
```sql
SELECT
  license_key,
  email,
  tier,
  is_active,
  created_at,
  (SELECT COUNT(*) FROM device_activations WHERE license_id = licenses.id) as device_count
FROM licenses
WHERE is_dev = true
ORDER BY created_at DESC;
```

### Deactivate all dev licenses
```sql
UPDATE licenses
SET is_active = false
WHERE is_dev = true;
```

### Delete all dev licenses (careful!)
```sql
DELETE FROM licenses WHERE is_dev = true;
```
