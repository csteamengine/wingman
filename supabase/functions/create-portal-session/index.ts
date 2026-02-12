// Supabase Edge Function: create-portal-session
// Creates a Stripe Customer Portal session for subscription management

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://wingman-dev.app",
  "https://www.wingman-dev.app",
  "http://localhost:5173",
  "tauri://localhost",
  "https://tauri.localhost",
];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("CORS_ORIGINS");
  if (!envOrigins) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = !origin || allowedOrigins.includes(origin);
  const resolvedOrigin = origin && isAllowed ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface CreatePortalSessionRequest {
  license_key: string;
  email: string;
  device_id: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: CreatePortalSessionRequest = await req.json();
    const { license_key, email, device_id } = body;

    if (!license_key || !email || !device_id) {
      return new Response(
        JSON.stringify({ error: "license_key, email, and device_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get client IP address for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     "unknown";

    // Rate limiting: max 10 portal requests per IP per hour
    const ipRateLimitIdentifier = `${clientIp}:create-portal-session`;
    const { data: ipRateLimited, error: ipRateLimitError } = await supabase.rpc("check_rate_limit", {
      p_identifier: ipRateLimitIdentifier,
      p_endpoint: "create-portal-session",
      p_max_attempts: 10,
      p_window_minutes: 60,
    });

    if (!ipRateLimitError && ipRateLimited) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Also rate-limit by license key to slow brute-force attempts
    const licenseRateLimitIdentifier = `${license_key}:create-portal-session`;
    const { data: licenseRateLimited, error: licenseRateLimitError } = await supabase.rpc("check_rate_limit", {
      p_identifier: licenseRateLimitIdentifier,
      p_endpoint: "create-portal-session-license",
      p_max_attempts: 5,
      p_window_minutes: 60,
    });

    if (!licenseRateLimitError && licenseRateLimited) {
      return new Response(
        JSON.stringify({ error: "Too many requests for this license. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Look up license and ensure the supplied email matches it
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("id, stripe_customer_id, is_active")
      .eq("license_key", license_key)
      .eq("email", email.toLowerCase())
      .single();

    if (licenseError || !license) {
      return new Response(
        JSON.stringify({ error: "License not found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!license.is_active) {
      return new Response(
        JSON.stringify({ error: "License is inactive" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Ensure the calling device is currently activated for this license
    const { data: activation, error: activationError } = await supabase
      .from("device_activations")
      .select("id")
      .eq("license_id", license.id)
      .eq("device_id", device_id)
      .single();

    if (activationError || !activation) {
      return new Response(
        JSON.stringify({ error: "Device is not activated for this license" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!license.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer associated with this license" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Stripe Billing Portal session
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: license.stripe_customer_id,
        return_url: "https://wingman-dev.app/",
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create portal session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const session = await response.json();
    console.log("Portal session created successfully");

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Create portal session error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
