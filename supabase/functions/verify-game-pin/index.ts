import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function checkRateLimit(supabase: any, key: string, limitCount: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  await supabase.from("rate_limit_events").delete().eq("key", key).lt("created_at", new Date(Date.now() - 300_000).toISOString());
  const { count } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= limitCount) return false;
  await supabase.from("rate_limit_events").insert({ key });
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile, pin } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Rate limiting: max 10 attempts per mobile per minute ──
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const limitKey = `pin:${ip}:${mobile}`;
    const allowed = await checkRateLimit(supabase, limitKey, 10, 60_000);
    if (!allowed) {
      return new Response(
        JSON.stringify({ valid: false, error: "Too many attempts. Please wait 1 minute.", code: "RATE_LIMITED", retryable: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pinHash = await hashPin(pin);

    // Check if this mobile+PIN has ANY valid game_access record (any match)
    const { data: anyAccess } = await supabase
      .from("game_access")
      .select("match_id")
      .eq("mobile", mobile)
      .eq("pin_hash", pinHash)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!anyAccess) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid mobile or PIN", code: "INVALID_CREDENTIALS" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User is valid — return mobile + has_any_access flag
    // Also return the most recent match_id for backward compatibility
    // And try to find the currently active match
    const { data: activeMatch } = await supabase
      .from("matches")
      .select("id")
      .eq("is_active_for_registration", true)
      .single();

    return new Response(
      JSON.stringify({
        valid: true,
        mobile,
        has_any_access: true,
        match_id: activeMatch?.id || anyAccess.match_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ valid: false, error: e.message, code: "INTERNAL_ERROR", retryable: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
