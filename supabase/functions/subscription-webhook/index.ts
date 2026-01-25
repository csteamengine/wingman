// Supabase Edge Function: subscription-webhook
// Handles Stripe subscription webhooks for Premium tier management

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Generate a license key in format: XXXX-XXXX-XXXX-XXXX
function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments: string[] = [];

  for (let i = 0; i < 4; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      segment += chars[randomIndex];
    }
    segments.push(segment);
  }

  return segments.join("-");
}

// Verify Stripe webhook signature
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const parts = signature.split(",");

    let timestamp = "";
    let v1Signature = "";

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      if (key === "v1") v1Signature = value;
    }

    if (!timestamp || !v1Signature) {
      console.error("Invalid signature format");
      return false;
    }

    // Check timestamp is within 5 minutes
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      console.error("Webhook timestamp too old");
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return expectedSignature === v1Signature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Log webhook event to database
async function logWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  eventType: string,
  payload: unknown,
  processed: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from("webhook_events").upsert(
      {
        stripe_event_id: eventId,
        event_type: eventType,
        payload,
        processed,
        error_message: errorMessage,
      },
      { onConflict: "stripe_event_id" }
    );
  } catch (error) {
    console.error("Failed to log webhook event:", error);
  }
}

// Send welcome email for new Premium subscription
async function sendPremiumWelcomeEmail(
  email: string,
  licenseKey: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Wingman <noreply@wingman-dev.app>",
        reply_to: "support@wingman-dev.app",
        to: email,
        subject: "Welcome to Wingman Premium!",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Welcome to Wingman Premium!</h1>

            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
              Thank you for subscribing to Wingman Premium. Your subscription is now active and you have access to all Premium features including AI-powered tools.
            </p>

            <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your License Key</p>
              <code style="font-size: 24px; font-weight: bold; color: #1a1a1a; letter-spacing: 2px;">${licenseKey}</code>
            </div>

            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px;">Premium Features:</h2>
            <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8; padding-left: 20px;">
              <li><strong>AI Prompt Optimizer</strong> - Transform rough notes into polished Claude Code prompts</li>
              <li><strong>Obsidian Integration</strong> - Quick capture to your Obsidian vault</li>
              <li><strong>1,000,000 AI tokens/month</strong> - Generous monthly allowance</li>
              <li><strong>All Pro features included</strong> - History, snippets, syntax highlighting & more</li>
            </ul>

            <div style="background: #e8f4e8; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #4ade80;">
              <p style="color: #166534; font-size: 14px; margin: 0;">
                <strong>Note:</strong> Your license also includes Wingman Pro. If you ever cancel your Premium subscription, you'll keep full access to all Pro features permanently.
              </p>
            </div>

            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px;">How to activate:</h2>
            <ol style="color: #4a4a4a; font-size: 16px; line-height: 1.8; padding-left: 20px;">
              <li>Open Wingman</li>
              <li>Go to Settings</li>
              <li>Enter your email and license key</li>
              <li>Click "Activate License"</li>
            </ol>

            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-top: 30px;">
              Your subscription renews monthly. You can manage or cancel anytime from your Stripe customer portal.
            </p>

            <p style="color: #999; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
              Questions? Reply to this email or contact <a href="mailto:support@wingman-dev.app">support@wingman-dev.app</a><br><br>
              — The Wingman Team<br>
              <a href="https://wingman-dev.app" style="color: #999;">wingman-dev.app</a>
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error:", errorText);
      return false;
    }

    console.log("Premium welcome email sent to:", email);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeWebhookSecret = Deno.env.get("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get raw body for signature verification
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(
      payload,
      signature,
      stripeWebhookSecret
    );
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the event
    const event = JSON.parse(payload);
    console.log("=== Stripe subscription webhook received ===");
    console.log("Event type:", event.type);
    console.log("Event ID:", event.id);

    // Handle subscription events
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;
        const email = subscription.customer_email?.toLowerCase();
        const status = subscription.status;
        const currentPeriodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null;
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        console.log("Subscription created:", {
          customerId,
          subscriptionId,
          email,
          status,
        });

        // Get customer email - either from subscription or fetch from Stripe
        let customerEmail = email;
        if (!customerEmail) {
          const customerResponse = await fetch(
            `https://api.stripe.com/v1/customers/${customerId}`,
            {
              headers: {
                Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
              },
            }
          );
          const customer = await customerResponse.json();
          customerEmail = customer.email?.toLowerCase();

          if (!customerEmail) {
            await logWebhookEvent(
              supabase,
              event.id,
              event.type,
              event.data.object,
              false,
              "No email found for customer"
            );
            return new Response(
              JSON.stringify({ error: "No email found for customer" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        console.log("Customer email resolved:", customerEmail);

        // Check if license already exists - first by stripe_customer_id, then by email
        // This handles both new customers AND Pro users upgrading to Premium
        let { data: existingLicense } = await supabase
          .from("licenses")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        // If not found by customer ID, try by email (Pro user upgrading)
        if (!existingLicense) {
          const { data: licenseByEmail } = await supabase
            .from("licenses")
            .select("*")
            .eq("email", customerEmail)
            .single();
          existingLicense = licenseByEmail;
        }

        let licenseKey: string;
        let licenseId: string;

        if (existingLicense) {
          // Use existing license - upgrade to premium
          licenseKey = existingLicense.license_key;
          licenseId = existingLicense.id;

          console.log("Upgrading existing license to premium:", {
            licenseId,
            previousTier: existingLicense.tier,
          });

          // Update tier to premium and set stripe_customer_id
          const { error: updateError } = await supabase
            .from("licenses")
            .update({
              tier: "premium",
              is_active: true,
              stripe_customer_id: customerId, // Link Stripe customer to existing license
            })
            .eq("id", licenseId);

          if (updateError) {
            console.error("Failed to update license to premium:", updateError);
            throw updateError;
          }
        } else {
          // Create new license for brand new customer
          licenseKey = generateLicenseKey();

          console.log("Creating new premium license for:", customerEmail);

          const { data: newLicense, error: insertError } = await supabase
            .from("licenses")
            .insert({
              license_key: licenseKey,
              email: customerEmail,
              is_active: true,
              tier: "premium",
              max_devices: 3,
              stripe_customer_id: customerId,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Failed to create license:", insertError);
            await logWebhookEvent(
              supabase,
              event.id,
              event.type,
              event.data.object,
              false,
              `Failed to create license: ${insertError.message}`
            );
            throw insertError;
          }

          licenseId = newLicense.id;
        }

        // Create subscription record
        const { error: subError } = await supabase.from("subscriptions").upsert(
          {
            user_id: licenseId,
            license_key: licenseKey,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status: status === "active" ? "active" : status,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end || false,
          },
          { onConflict: "stripe_subscription_id" }
        );

        if (subError) {
          console.error("Failed to create subscription record:", subError);
          await logWebhookEvent(
            supabase,
            event.id,
            event.type,
            event.data.object,
            false,
            `Failed to create subscription: ${subError.message}`
          );
          throw subError;
        }

        // Send welcome email
        await sendPremiumWelcomeEmail(customerEmail, licenseKey);

        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription created successfully",
            license_key: licenseKey,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const status = subscription.status;
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        console.log("Subscription updated:", {
          subscriptionId,
          status,
          cancelAtPeriodEnd,
        });

        // Determine the subscription status
        let dbStatus = status;
        if (cancelAtPeriodEnd && status === "active") {
          // User cancelled but still has access until period end
          dbStatus = "cancelled";
        }

        // Update subscription record
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            status: dbStatus,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            cancelled_at: cancelAtPeriodEnd ? new Date().toISOString() : null,
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (updateError) {
          console.error("Failed to update subscription:", updateError);
          await logWebhookEvent(
            supabase,
            event.id,
            event.type,
            event.data.object,
            false,
            `Failed to update subscription: ${updateError.message}`
          );
          throw updateError;
        }

        // If subscription is still active or cancelled (but not expired), keep premium access
        // If subscription is past_due or expired, downgrade to pro (they still paid for something)
        if (status === "past_due" || status === "unpaid") {
          // Get the license and downgrade to pro
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", subscriptionId)
            .single();

          if (sub) {
            await supabase
              .from("licenses")
              .update({ tier: "pro" })
              .eq("id", sub.user_id);
          }
        }

        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription updated",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "customer.subscription.deleted": {
        // Subscription ended (after cancellation period or immediate)
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        console.log("Subscription deleted:", subscriptionId);

        // Get the subscription record
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id, license_key")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (sub) {
          // Update subscription status to expired
          await supabase
            .from("subscriptions")
            .update({ status: "expired" })
            .eq("stripe_subscription_id", subscriptionId);

          // Former Premium subscribers get Pro access (they paid for something)
          await supabase
            .from("licenses")
            .update({ tier: "pro", is_active: true })
            .eq("id", sub.user_id);
        }

        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription ended - user downgraded to Pro",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "customer.subscription.resumed": {
        // Subscription reactivated (unpause or renewal)
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        console.log("Subscription resumed:", subscriptionId);

        // Update subscription record
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: false,
            cancelled_at: null,
          })
          .eq("stripe_subscription_id", subscriptionId);

        // Get the license and upgrade back to premium
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (sub) {
          await supabase
            .from("licenses")
            .update({ tier: "premium", is_active: true })
            .eq("id", sub.user_id);
        }

        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription resumed - Premium reactivated",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "invoice.payment_succeeded": {
        // Successful payment (renewal)
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          console.log("Invoice paid for subscription:", subscriptionId);

          // Ensure subscription is marked active
          await supabase
            .from("subscriptions")
            .update({ status: "active" })
            .eq("stripe_subscription_id", subscriptionId);
        }

        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({ success: true, message: "Payment recorded" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "invoice.payment_failed": {
        // Failed payment
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          console.log("Payment failed for subscription:", subscriptionId);

          // Mark subscription as past_due
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);
        }

        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({ success: true, message: "Payment failure recorded" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        // Log unhandled event types
        console.log("Unhandled subscription event type:", event.type);
        await logWebhookEvent(
          supabase,
          event.id,
          event.type,
          event.data.object,
          true
        );

        return new Response(
          JSON.stringify({ success: true, message: "Event received" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Subscription webhook error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
