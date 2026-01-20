// Supabase Edge Function: claude-proxy
// Proxies requests to Claude API with Premium license validation and token limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Token limit per month for Premium tier
const MONTHLY_TOKEN_LIMIT = 1_000_000;

// Claude model to use for cost efficiency
// Using Claude 3.5 Haiku - fast and affordable
const CLAUDE_MODEL = "claude-3-5-haiku-20241022";

// System prompts for different AI features
const SYSTEM_PROMPTS: Record<string, string> = {
  prompt_optimizer: `You are a prompt optimizer for Claude Code. Take the user's rough notes, bullet points, or unstructured text and transform them into a clear, well-structured prompt optimized for Claude Code.

Your task:
1. Analyze the user's input to understand their intent and requirements
2. Reorganize the information into a logical structure
3. Add clarity and specificity where needed
4. Format with proper structure including:
   - Context/Background (if relevant)
   - Task description
   - Requirements/Constraints
   - Desired output format

Guidelines:
- Maintain ALL technical details and requirements from the original
- Preserve any code blocks, file paths, or technical terminology exactly
- Don't add requirements that weren't implied
- Don't remove any information the user provided
- Use clear, imperative language
- If the input is already well-structured, make minimal changes
- Keep the prompt concise but complete

Output only the optimized prompt, no explanations or meta-commentary.`,

  quick_note: `You are a helpful assistant that processes and formats notes. Take the user's quick note and:
1. Fix any obvious typos
2. Format bullet points or lists properly
3. Add minimal structure if needed
4. Keep the original meaning and tone intact

Output only the processed note, nothing else.`,
};

interface ClaudeProxyRequest {
  prompt: string;
  feature: string;
  license_key: string;
  system_instructions?: string; // Optional custom system instructions
}

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate Claude API key is configured
    if (!claudeApiKey) {
      console.error("CLAUDE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: ClaudeProxyRequest = await req.json();
    const { prompt, feature, license_key, system_instructions } = body;

    // Validate required fields
    if (!prompt || !license_key) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: prompt and license_key are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate feature
    const validFeatures = Object.keys(SYSTEM_PROMPTS);
    if (!feature || !validFeatures.includes(feature)) {
      return new Response(
        JSON.stringify({
          error: `Invalid feature. Valid features: ${validFeatures.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get current month in YYYY-MM format (UTC)
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    // Validate Premium license and check access
    const { data: accessData, error: accessError } = await supabase.rpc(
      "has_premium_access",
      { p_license_key: license_key }
    );

    if (accessError) {
      console.error("Error checking premium access:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to validate license" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const access = accessData?.[0];

    if (!access || !access.has_access) {
      return new Response(
        JSON.stringify({
          error: "Invalid license key",
          code: "INVALID_LICENSE",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user has Premium tier (required for AI features)
    if (access.tier !== "premium") {
      return new Response(
        JSON.stringify({
          error: "AI features require a Premium subscription",
          code: "PREMIUM_REQUIRED",
          current_tier: access.tier,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if subscription is active (not expired)
    if (!access.is_active) {
      return new Response(
        JSON.stringify({
          error: "Your Premium subscription has expired. Please renew to continue using AI features.",
          code: "SUBSCRIPTION_EXPIRED",
          expired_at: access.current_period_end,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check token limit
    const tokensUsed = Number(access.tokens_used) || 0;
    const tokensRemaining = Number(access.tokens_remaining) || 0;

    if (tokensRemaining <= 0) {
      // Calculate reset date (1st of next month at 00:00 UTC)
      const nextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      );
      const resetDate = nextMonth.toISOString().split("T")[0];

      return new Response(
        JSON.stringify({
          error: "Monthly token limit reached",
          code: "TOKEN_LIMIT_EXCEEDED",
          tokens_used: tokensUsed,
          tokens_limit: MONTHLY_TOKEN_LIMIT,
          resets_at: resetDate,
          message: `You've used all ${MONTHLY_TOKEN_LIMIT.toLocaleString()} tokens for this month. Your limit resets on ${resetDate}.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user_id for usage tracking
    const { data: licenseData } = await supabase
      .from("licenses")
      .select("id")
      .eq("license_key", license_key)
      .single();

    if (!licenseData) {
      return new Response(
        JSON.stringify({ error: "License not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = licenseData.id;

    // Sanitize user input (basic XSS prevention)
    const sanitizedPrompt = prompt
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .trim();

    if (!sanitizedPrompt) {
      return new Response(
        JSON.stringify({ error: "Prompt cannot be empty after sanitization" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the system prompt for this feature - use custom instructions if provided
    const finalSystemPrompt = system_instructions || SYSTEM_PROMPTS[feature];

    // Call Claude API
    console.log(`Calling Claude API for feature: ${feature}`);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: finalSystemPrompt,
        messages: [
          {
            role: "user",
            content: sanitizedPrompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errorText);

      // Handle specific Claude errors
      if (claudeResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "AI service is temporarily busy. Please try again in a moment.",
            code: "RATE_LIMITED",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (claudeResponse.status === 401) {
        console.error("Claude API key is invalid or not set correctly");
        return new Response(
          JSON.stringify({
            error: "AI service configuration error. Please contact support.",
            code: "SERVICE_ERROR",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (claudeResponse.status === 400) {
        // Bad request - likely invalid model or parameters
        console.error("Claude API bad request - check model name and parameters");
        return new Response(
          JSON.stringify({
            error: "AI request configuration error. Please contact support.",
            code: "CONFIG_ERROR",
            details: errorText,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Failed to process AI request. Please try again.",
          code: "AI_ERROR",
          status: claudeResponse.status,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const claudeData: ClaudeResponse = await claudeResponse.json();

    // Extract the response text
    const responseText =
      claudeData.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("") || "";

    // Calculate total tokens used
    const inputTokens = claudeData.usage?.input_tokens || 0;
    const outputTokens = claudeData.usage?.output_tokens || 0;
    const totalTokensUsed = inputTokens + outputTokens;

    // Update token usage in database atomically
    const { data: usageData, error: usageError } = await supabase.rpc(
      "increment_token_usage",
      {
        p_user_id: userId,
        p_tokens: totalTokensUsed,
      }
    );

    if (usageError) {
      console.error("Failed to update token usage:", usageError);
      // Don't fail the request, just log the error
    }

    // Calculate updated usage stats
    const newTokensUsed = usageData?.[0]?.new_tokens_used || tokensUsed + totalTokensUsed;
    const newRequestCount = usageData?.[0]?.request_count || 1;
    const newTokensRemaining = Math.max(MONTHLY_TOKEN_LIMIT - newTokensUsed, 0);

    console.log(
      `Request complete: ${totalTokensUsed} tokens used, ${newTokensRemaining} remaining`
    );

    // Return successful response
    return new Response(
      JSON.stringify({
        result: responseText,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tokens_used_this_request: totalTokensUsed,
        tokens_used_this_month: newTokensUsed,
        tokens_remaining: newTokensRemaining,
        request_count: newRequestCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Claude proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
