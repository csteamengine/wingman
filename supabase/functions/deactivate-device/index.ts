// Supabase Edge Function: deactivate-device
// Removes a device activation from a license

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { error: deleteError, count } = await supabase
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
