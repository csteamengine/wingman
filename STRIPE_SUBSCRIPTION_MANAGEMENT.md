# Stripe Subscription Management Implementation

## Overview
Added the ability for Premium users to manage their Stripe subscriptions directly from the Wingman app's Licensing & Updates settings page. Users can now access the Stripe Customer Portal to update payment methods, view billing history, and cancel their subscriptions.

## Changes Made

### 1. Backend (Rust)

#### `/src-tauri/src/premium.rs`
- Added `PortalSessionResponse` struct to deserialize the Supabase edge function response
- Added `create_customer_portal_session()` function that:
  - Calls the Supabase `create-portal-session` edge function
  - Passes the user's license key for validation
  - Returns the Stripe Customer Portal URL
  - Handles errors appropriately

#### `/src-tauri/src/lib.rs`
- Imported `create_customer_portal_session` from the premium module
- Added `create_customer_portal_session_cmd` Tauri command wrapper
- Registered the command in the `invoke_handler` list

### 2. Frontend (TypeScript/React)

#### `/src/components/SettingsPanel.tsx`
- Added new "Subscription Management" section in the License & Updates tab
- Section only appears for Premium tier users (`isPremium`)
- Displays helpful description text explaining what users can do
- "Manage Subscription" button that:
  - Retrieves the license key from localStorage
  - Calls the `create_customer_portal_session_cmd` Tauri command
  - Opens the returned Stripe portal URL in the user's browser
  - Shows appropriate error messages if something fails

### 3. Supabase Edge Function (Already Existed)

The edge function at `/supabase/functions/create-portal-session/index.ts` was already implemented and handles:
- License key validation
- Fetching the Stripe customer ID from the database
- Creating a Stripe billing portal session
- Returning the portal URL

## How It Works

1. **User clicks "Manage Subscription"** in Settings → License & Updates
2. **Frontend** retrieves the license key from localStorage
3. **Frontend** invokes the `create_customer_portal_session_cmd` Tauri command
4. **Rust backend** calls the Supabase edge function with the license key
5. **Edge function** validates the license, retrieves the Stripe customer ID, and creates a portal session
6. **Stripe** returns a portal session URL
7. **Backend** returns the URL to the frontend
8. **Frontend** opens the URL in the user's default browser
9. **User** manages their subscription in the Stripe Customer Portal
10. **User** is redirected back to the app (via `wingman://settings` deep link) after completion

## Requirements

### Supabase Edge Function
The edge function requires these environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `STRIPE_SECRET_KEY` - Stripe secret key for API calls

### Database Schema
The `licenses` table must have:
- `license_key` column
- `tier` column (should be 'premium' for subscription management access)
- `stripe_customer_id` column (populated when user creates subscription)
- `email` column
- `status` column

## User Experience

### For Premium Users:
1. Navigate to Settings (⌘,)
2. Click on "License & Updates" tab
3. See their AI Token Usage (if applicable)
4. See a new "Subscription Management" section
5. Click "Manage Subscription" button
6. Browser opens with Stripe Customer Portal
7. Can view invoices, update payment method, or cancel subscription

### For Non-Premium Users:
- The "Subscription Management" section is not visible
- Only Pro and Free tier users won't see this option

## Security Considerations

✅ **Secure**: All Stripe API calls happen server-side via the Supabase edge function
✅ **Validated**: License key is validated before creating portal session
✅ **Protected**: Stripe secret key never exposed to the client
✅ **Authorized**: Only users with valid Premium licenses can access their portal

## Testing Checklist

- [ ] Premium user can click "Manage Subscription" button
- [ ] Button opens Stripe Customer Portal in browser
- [ ] Portal shows correct customer information
- [ ] User can view billing history
- [ ] User can update payment method
- [ ] User can cancel subscription
- [ ] Error handling works for invalid license keys
- [ ] Error handling works for network failures
- [ ] Non-Premium users don't see the section
- [ ] Deep link return URL works (optional - depends on URL scheme setup)

## Error Handling

The implementation includes comprehensive error handling:

1. **No license key**: Shows alert "License key not found. Please activate your license first."
2. **Invalid license**: Backend returns validation error
3. **Network failure**: Shows alert with error message
4. **No Stripe customer**: Edge function returns appropriate error
5. **Edge function error**: Logged to console and shown to user

## Notes

- The Stripe Customer Portal URL includes a `return_url` parameter set to `wingman://settings`
- This deep link will only work if the app has properly registered the URL scheme
- If the URL scheme isn't set up, users will see a browser error when they finish in the portal (but this won't affect their subscription management)
- The portal session URL expires after a short time for security

## Future Enhancements

Potential improvements for the future:
- Add a loading state while fetching the portal URL
- Cache the portal URL for a few seconds to avoid multiple API calls
- Add analytics tracking for subscription management clicks
- Show subscription status (active/canceled) in the UI
- Display next billing date in the settings
- Add webhook handling for subscription updates to refresh local state
