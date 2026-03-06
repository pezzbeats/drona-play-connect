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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mobile, pin } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const pinHash = await hashPin(pin);

    // Get active match
    const { data: match } = await supabase.from("matches").select("id").eq("is_active_for_registration", true).single();
    if (!match) {
      // Try to find any match with active game access for this mobile
      const { data: access } = await supabase
        .from("game_access")
        .select("*, matches(id)")
        .eq("mobile", mobile)
        .eq("pin_hash", pinHash)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (access) {
        return new Response(JSON.stringify({ valid: true, match_id: (access as any).matches?.id || access.match_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("No active match");
    }

    const { data: access } = await supabase
      .from("game_access")
      .select("*")
      .eq("mobile", mobile)
      .eq("match_id", match.id)
      .eq("pin_hash", pinHash)
      .eq("is_active", true)
      .single();

    return new Response(
      JSON.stringify({ valid: !!access, match_id: match.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ valid: false, error: e.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
