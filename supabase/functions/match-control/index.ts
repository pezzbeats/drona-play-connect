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

    const { action, match_id, phase, batting_team_id, bowling_team_id, target_runs } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch or create live state
    const { data: existing } = await supabase
      .from("match_live_state")
      .select("*")
      .eq("match_id", match_id)
      .single();

    if (action === "init") {
      // Initialize live state
      if (existing) {
        const { data, error } = await supabase
          .from("match_live_state")
          .update({ phase: "pre", updated_at: new Date().toISOString() })
          .eq("match_id", match_id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, state: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { data, error } = await supabase
          .from("match_live_state")
          .insert({ match_id, phase: "pre", updated_at: new Date().toISOString() })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, state: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "set_phase") {
      const updateData: any = { phase, updated_at: new Date().toISOString() };
      if (batting_team_id) updateData.batting_team_id = batting_team_id;
      if (bowling_team_id) updateData.bowling_team_id = bowling_team_id;
      if (phase === "innings2" && target_runs) updateData.target_runs = target_runs;
      if (phase === "innings2") {
        // Swap batting and bowling teams
        if (existing) {
          updateData.batting_team_id = existing.bowling_team_id;
          updateData.bowling_team_id = existing.batting_team_id;
          updateData.target_runs = (existing.innings1_score || 0) + 1;
        }
        updateData.current_innings = 2;
      }

      let data, error;
      if (existing) {
        ({ data, error } = await supabase
          .from("match_live_state")
          .update(updateData)
          .eq("match_id", match_id)
          .select()
          .single());
      } else {
        ({ data, error } = await supabase
          .from("match_live_state")
          .insert({ match_id, ...updateData })
          .select()
          .single());
      }
      if (error) throw error;

      // Also update match status
      const matchStatus = phase === "pre" ? "live" : phase === "ended" ? "ended" : "live";
      await supabase.from("matches").update({ status: matchStatus as any }).eq("id", match_id);

      return new Response(JSON.stringify({ success: true, state: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_players") {
      const { striker_id, non_striker_id, bowler_id } = await req.json().catch(() => ({}));
      const updateData: any = { updated_at: new Date().toISOString() };
      if (striker_id !== undefined) updateData.current_striker_id = striker_id;
      if (non_striker_id !== undefined) updateData.current_non_striker_id = non_striker_id;
      if (bowler_id !== undefined) updateData.current_bowler_id = bowler_id;

      const { data, error } = await supabase
        .from("match_live_state")
        .update(updateData)
        .eq("match_id", match_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, state: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
