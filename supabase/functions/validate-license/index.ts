// Supabase Edge Function: validate-license
// Validates a license key and registers/updates device activation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  license_key: string;
  email: string;
  device_id: string;
  device_name?: string;
  os?: string;
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

    const body: ValidateRequest = await req.json();
    const { license_key, email, device_id, device_name, os } = body;

    // Validate required fields
    if (!license_key || !email || !device_id) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Missing required fields: license_key, email, device_id",
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
      .select("*")
      .eq("license_key", license_key)
      .eq("email", email.toLowerCase())
      .single();

    if (licenseError || !license) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid license key or email",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if license is active
    if (!license.is_active) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "License has been deactivated",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check existing device activations
    const { data: existingActivations, error: activationsError } = await supabase
      .from("device_activations")
      .select("*")
      .eq("license_id", license.id);

    if (activationsError) {
      throw activationsError;
    }

    const deviceCount = existingActivations?.length || 0;
    const existingDevice = existingActivations?.find(
      (a) => a.device_id === device_id
    );

    // If this device is already activated, update last_validated_at
    if (existingDevice) {
      await supabase
        .from("device_activations")
        .update({
          last_validated_at: new Date().toISOString(),
          device_name: device_name || existingDevice.device_name,
          os: os || existingDevice.os,
        })
        .eq("id", existingDevice.id);

      return new Response(
        JSON.stringify({
          valid: true,
          tier: license.tier,
          message: "License validated successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check device limit for new devices
    if (deviceCount >= license.max_devices) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Device limit exceeded. Maximum ${license.max_devices} devices allowed. Please deactivate a device first.`,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Register new device
    const { error: insertError } = await supabase
      .from("device_activations")
      .insert({
        license_id: license.id,
        device_id,
        device_name: device_name || "Unknown Device",
        os: os || "Unknown",
        last_validated_at: new Date().toISOString(),
      });

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        valid: true,
        tier: license.tier,
        message: "License activated successfully on this device",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
