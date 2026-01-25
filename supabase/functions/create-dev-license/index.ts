// Supabase Edge Function: create-dev-license
// Securely creates development licenses for QA/testing
// Protected by DEV_LICENSE_SECRET environment variable

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Send dev license key email via Resend
async function sendDevLicenseEmail(
  email: string,
  licenseKey: string,
  tier: string,
  maxDevices: number
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  console.log("=== sendDevLicenseEmail called ===");
  console.log("Email:", email);
  console.log("Tier:", tier);
  console.log("RESEND_API_KEY present:", !!resendApiKey);
  console.log("RESEND_API_KEY length:", resendApiKey?.length || 0);

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const emailPayload = {
      from: "Wingman <noreply@wingman-dev.app>",
      reply_to: "support@wingman-dev.app",
      to: email,
      subject: "Your Wingman Dev/QA License Key",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Your Wingman Dev License is Ready!</h1>

          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            You've been granted a development license for QA testing and feature validation. This license includes access to the <strong>dev tier switcher</strong> for testing all features.
          </p>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; font-size: 14px; margin: 0; font-weight: 600;">
              🔧 Dev License
            </p>
            <p style="color: #856404; font-size: 13px; margin: 5px 0 0 0;">
              This is a testing license. The tier switcher will appear in the top-right corner of the app.
            </p>
          </div>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your License Key</p>
            <code style="font-size: 24px; font-weight: bold; color: #1a1a1a; letter-spacing: 2px;">${licenseKey}</code>
            <p style="color: #666; font-size: 12px; margin: 15px 0 0 0;">
              Tier: <strong style="color: #1a1a1a;">${tier.toUpperCase()}</strong> | Max Devices: <strong style="color: #1a1a1a;">${maxDevices}</strong>
            </p>
          </div>

          <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px;">How to activate:</h2>
          <ol style="color: #4a4a4a; font-size: 16px; line-height: 1.8; padding-left: 20px;">
            <li>Open Wingman</li>
            <li>Go to Settings (⌘ + ,)</li>
            <li>Navigate to the "License & Updates" tab</li>
            <li>Enter your email and license key</li>
            <li>Click "Activate License"</li>
          </ol>

          <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px;">Using the Dev Tier Switcher:</h2>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            After activation, you'll see an orange "Dev" badge in the top-right corner with tier buttons. Click them to test different feature sets:
          </p>
          <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8; padding-left: 20px;">
            <li><strong>Free</strong> - All Pro features locked</li>
            <li><strong>Pro</strong> - All Pro features unlocked</li>
            <li><strong>Premium</strong> - Pro + AI features unlocked</li>
            <li><strong>Real</strong> - Returns to your actual license tier</li>
          </ul>

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

    console.log("Sending dev license email to Resend API...");
    console.log("Email payload to:", emailPayload.to);
    console.log("Email payload from:", emailPayload.from);

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
      return { success: false, error: `Resend API error: ${response.status} - ${responseText}` };
    }

    console.log("Dev license email sent successfully to:", email);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to send dev license email:", errorMsg);
    console.error("Full error:", error);
    return { success: false, error: errorMsg };
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateDevLicenseRequest {
  email: string;
  tier?: "pro" | "premium";
  max_devices?: number;
  secret: string;
}

// Generate a license key in format: XXXX-XXXX-XXXX-XXXX
function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = 4;
  const segmentLength = 4;

  const key = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => {
      return chars.charAt(Math.floor(Math.random() * chars.length));
    }).join("");
  }).join("-");

  return key;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const devLicenseSecret = Deno.env.get("DEV_LICENSE_SECRET");

    // Check if DEV_LICENSE_SECRET is configured
    if (!devLicenseSecret) {
      return new Response(
        JSON.stringify({
          error: "Dev license creation not configured. Set DEV_LICENSE_SECRET environment variable.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: CreateDevLicenseRequest = await req.json();
    const { email, tier = "pro", max_devices = 3, secret } = body;

    // Validate secret
    if (secret !== devLicenseSecret) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Invalid secret",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Missing required field: email",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate tier
    if (tier !== "pro" && tier !== "premium") {
      return new Response(
        JSON.stringify({
          error: "Invalid tier. Must be 'pro' or 'premium'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate unique license key
    let licenseKey: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      licenseKey = generateLicenseKey();
      const { data: existing } = await supabase
        .from("licenses")
        .select("id")
        .eq("license_key", licenseKey)
        .single();

      if (!existing) {
        isUnique = true;
        break;
      }
      attempts++;
    }

    if (!isUnique) {
      return new Response(
        JSON.stringify({
          error: "Failed to generate unique license key. Please try again.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create dev license
    const { data: license, error: insertError } = await supabase
      .from("licenses")
      .insert({
        license_key: licenseKey!,
        email: email.toLowerCase(),
        tier,
        max_devices,
        is_active: true,
        is_dev: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to create dev license",
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Dev license created:", {
      license_key: licenseKey,
      email: email.toLowerCase(),
      tier,
    });

    // Send dev license email
    const emailResult = await sendDevLicenseEmail(email.toLowerCase(), licenseKey!, tier, max_devices);

    const response = {
      success: true,
      license_key: licenseKey,
      email: email.toLowerCase(),
      tier,
      max_devices,
      is_dev: true,
      email_sent: emailResult.success,
      message: emailResult.success
        ? "Dev license created and emailed successfully"
        : `Dev license created but email failed: ${emailResult.error}`,
    };

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating dev license:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
