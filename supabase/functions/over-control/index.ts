import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, match_id, innings_no, over_no, over_id, bowler_id, status } = body;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "create_over") {
      const inningsNo = innings_no || 1;

      // ── Race condition guard: reject if an active over already exists ──
      const { data: existingActive } = await supabase
        .from("over_control")
        .select("id, over_no")
        .eq("match_id", match_id)
        .eq("innings_no", inningsNo)
        .eq("status", "active")
        .maybeSingle();

      if (existingActive) {
        return new Response(
          JSON.stringify({ error: `Over ${existingActive.over_no} is already active. Complete it before starting a new one.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine next over number
      const { data: existingOvers } = await supabase
        .from("over_control")
        .select("over_no")
        .eq("match_id", match_id)
        .eq("innings_no", inningsNo)
        .order("over_no", { ascending: false })
        .limit(1);

      const nextOverNo = existingOvers && existingOvers.length > 0 ? existingOvers[0].over_no + 1 : 1;

      const { data, error } = await supabase
        .from("over_control")
        .insert({
          match_id,
          innings_no: inningsNo,
          over_no: over_no || nextOverNo,
          status: "active",
          bowler_id: bowler_id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Update live state with current bowler
      if (bowler_id) {
        await supabase
          .from("match_live_state")
          .update({ current_bowler_id: bowler_id, updated_at: new Date().toISOString() })
          .eq("match_id", match_id);
      }

      return new Response(JSON.stringify({ success: true, over: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_over") {
      if (!over_id) throw new Error("over_id required");
      const updateData: any = {};
      if (status) updateData.status = status;
      if (bowler_id !== undefined) updateData.bowler_id = bowler_id;

      const { data, error } = await supabase
        .from("over_control")
        .update(updateData)
        .eq("id", over_id)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, over: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
