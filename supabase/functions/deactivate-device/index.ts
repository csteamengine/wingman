// Supabase Edge Function: deactivate-device
// Removes a device activation from a license

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeactivateRequest {
  license_key: string;
  device_id: string;
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

    const body: DeactivateRequest = await req.json();
    const { license_key, device_id } = body;

    // Get client IP address for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     "unknown";

    // Rate limiting: max 10 deactivations per IP per hour
    const rateLimitIdentifier = `${clientIp}:deactivate-device`;
    const { data: isRateLimited, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
      p_identifier: rateLimitIdentifier,
      p_endpoint: "deactivate-device",
      p_max_attempts: 10,
      p_window_minutes: 60,
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Continue without rate limiting if there's an error
    } else if (isRateLimited) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many deactivation attempts. Please try again later.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    if (!license_key || !device_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: license_key, device_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Additional rate limiting: max 5 deactivations per license key per hour
    const licenseRateLimitIdentifier = `${license_key}:deactivate-device`;
    const { data: isLicenseRateLimited, error: licenseRateLimitError } = await supabase.rpc("check_rate_limit", {
      p_identifier: licenseRateLimitIdentifier,
      p_endpoint: "deactivate-device-license",
      p_max_attempts: 5,
      p_window_minutes: 60,
    });

    if (licenseRateLimitError) {
      console.error("License rate limit check error:", licenseRateLimitError);
      // Continue without rate limiting if there's an error
    } else if (isLicenseRateLimited) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many deactivations for this license. Please try again later.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Look up the license
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("id")
      .eq("license_key", license_key)
      .single();

    if (licenseError || !license) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid license key",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Delete the device activation
    const { error: deleteError } = await supabase
      .from("device_activations")
      .delete()
      .eq("license_id", license.id)
      .eq("device_id", device_id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Device deactivated successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Deactivation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
