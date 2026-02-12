// Supabase Edge Function: create-premium-checkout
// Creates a Stripe Checkout session for Premium subscription

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Premium subscription price ID from Stripe (uses env var with fallback)
const PREMIUM_PRICE_ID = Deno.env.get("STRIPE_PREMIUM_PRICE_ID") || "price_1SrJYy7RJqZ8IvBxZm22ZDia";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

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

    // Parse optional request body for customer email
    let customerEmail: string | undefined;
    try {
      const body = await req.json();
      customerEmail = body.email;
    } catch {
      // Body is optional
    }

    // Build the checkout session parameters
    const params = new URLSearchParams({
      "mode": "subscription",
      "line_items[0][price]": PREMIUM_PRICE_ID,
      "line_items[0][quantity]": "1",
      "success_url": "https://wingman-dev.app/thank-you-premium.html",
      "cancel_url": "https://wingman-dev.app/#pricing",
      "subscription_data[metadata][product]": "wingman_premium",
      "allow_promotion_codes": "true",
    });

    // Add customer email if provided (for pre-filling checkout)
    if (customerEmail) {
      params.append("customer_email", customerEmail);
    }

    // Create Stripe Checkout Session for subscription
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create checkout session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const session = await response.json();
    console.log("Premium checkout session created:", session.id);

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
        session_id: session.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Create premium checkout session error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
