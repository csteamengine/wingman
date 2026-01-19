// Supabase Edge Function: stripe-webhook
// Handles Stripe purchase webhooks, creates licenses, and emails them to customers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// Send license key email via Resend
async function sendLicenseEmail(email: string, licenseKey: string): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  console.log("sendLicenseEmail called for:", email);
  console.log("RESEND_API_KEY present:", !!resendApiKey);
  console.log("RESEND_API_KEY length:", resendApiKey?.length || 0);

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const emailPayload = {
      from: "Wingman <noreply@wingman-dev.app>",
      reply_to: "support@wingman-dev.app",
      to: email,
      subject: "Your Wingman Pro License Key",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Thank you for purchasing Wingman Pro!</h1>

          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            Your license key is ready. Use it to activate Wingman Pro on up to 2 devices.
          </p>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your License Key</p>
            <code style="font-size: 24px; font-weight: bold; color: #1a1a1a; letter-spacing: 2px;">${licenseKey}</code>
          </div>

          <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px;">How to activate:</h2>
          <ol style="color: #4a4a4a; font-size: 16px; line-height: 1.8; padding-left: 20px;">
            <li>Open Wingman</li>
            <li>Go to Settings (⌘ + ,)</li>
            <li>Scroll to the License section</li>
            <li>Enter your email and license key</li>
            <li>Click "Activate License"</li>
          </ol>

          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-top: 30px;">
            If you have any issues, reply to this email or contact us at <a href="mailto:support@wingman-dev.app">support@wingman-dev.app</a>.
          </p>

          <p style="color: #999; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            — The Wingman Team<br>
            <a href="https://wingman-dev.app" style="color: #999;">wingman-dev.app</a>
          </p>
        </div>
      `,
    };

    console.log("Sending email to Resend API...");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const responseText = await response.text();
    console.log("Resend API response status:", response.status);
    console.log("Resend API response body:", responseText);

    if (!response.ok) {
      console.error("Resend API error:", responseText);
      return false;
    }

    console.log("License email sent successfully to:", email);
    return true;
  } catch (error) {
    console.error("Failed to send email, error:", error);
    return false;
  }
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
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return expectedSignature === v1Signature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const isValid = await verifyStripeSignature(payload, signature, stripeWebhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the event
    const event = JSON.parse(payload);
    console.log("Stripe webhook received:", event.type);

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details?.email?.toLowerCase();
      const sessionId = session.id;
      const customerId = session.customer;

      console.log("Checkout completed:", { email, sessionId, customerId });

      if (!email) {
        console.error("No email in checkout session");
        return new Response(
          JSON.stringify({ error: "No email in checkout session" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if license already exists for this session
      const { data: existingLicense } = await supabase
        .from("licenses")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .single();

      if (existingLicense) {
        // Resend the email with existing license
        await sendLicenseEmail(email, existingLicense.license_key);

        return new Response(
          JSON.stringify({
            success: true,
            message: "License already exists, email resent",
            license_key: existingLicense.license_key,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate new license key
      const licenseKey = generateLicenseKey();

      // Create new license
      const { data: newLicense, error: insertError } = await supabase
        .from("licenses")
        .insert({
          license_key: licenseKey,
          email,
          is_active: true,
          tier: "pro",
          max_devices: 2,
          stripe_session_id: sessionId,
          stripe_customer_id: customerId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create license:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create license" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("License created:", {
        license_key: licenseKey,
        email,
        session_id: sessionId,
      });

      // Send license key email
      const emailSent = await sendLicenseEmail(email, licenseKey);

      return new Response(
        JSON.stringify({
          success: true,
          message: emailSent
            ? "License created and emailed successfully"
            : "License created but email failed - check logs",
          license_key: licenseKey,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle charge.refunded
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const customerId = charge.customer;

      console.log("Charge refunded for customer:", customerId);

      if (customerId) {
        const { error: deactivateError } = await supabase
          .from("licenses")
          .update({ is_active: false })
          .eq("stripe_customer_id", customerId);

        if (deactivateError) {
          console.error("Failed to deactivate license:", deactivateError);
        } else {
          console.log("License deactivated for customer:", customerId);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Refund processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Unhandled event type
    console.log("Unhandled event type:", event.type);
    return new Response(
      JSON.stringify({ success: true, message: "Event received" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
