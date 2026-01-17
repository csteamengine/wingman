// Supabase Edge Function: gumroad-webhook
// Handles Gumroad purchase webhooks, creates licenses, and emails them to customers

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

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Wingman <noreply@wingman-editor.app>",
        reply_to: "support@wingman-editor.app",
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
              If you have any issues, reply to this email or contact us at <a href="mailto:support@wingman-editor.app">support@wingman-editor.app</a>.
            </p>

            <p style="color: #999; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
              — The Wingman Team<br>
              <a href="https://wingman-editor.app" style="color: #999;">wingman-editor.app</a>
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return false;
    }

    console.log("License email sent successfully to:", email);
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data (Gumroad sends as form-urlencoded)
    const formData = await req.formData();
    const data: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value.toString();
    }

    const email = data.email?.toLowerCase();
    const saleId = data.sale_id;
    const productId = data.product_id;
    const productName = data.product_name || "Wingman Pro";
    const refunded = data.refunded === "true";
    const isTest = data.test === "true";

    console.log("Gumroad webhook received:", {
      email,
      saleId,
      productId,
      productName,
      refunded,
      isTest,
    });

    // Validate required fields
    if (!email || !saleId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle refunds - deactivate the license
    if (refunded) {
      const { error: deactivateError } = await supabase
        .from("licenses")
        .update({ is_active: false })
        .eq("gumroad_sale_id", saleId);

      if (deactivateError) {
        console.error("Failed to deactivate license:", deactivateError);
      }

      return new Response(
        JSON.stringify({ success: true, message: "License deactivated due to refund" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if license already exists for this sale
    const { data: existingLicense } = await supabase
      .from("licenses")
      .select("*")
      .eq("gumroad_sale_id", saleId)
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
        gumroad_sale_id: saleId,
        gumroad_product_id: productId,
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
      sale_id: saleId,
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
