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

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { order_id, admin_id, method, amount, reference_no } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { error } = await supabase.from("payment_collections").insert({
      order_id, collected_by_admin_id: admin_id, method, amount, reference_no: reference_no || null,
    });
    if (error) throw error;

    await supabase.from("orders").update({ payment_status: "paid_manual_verified", payment_verified_at: new Date().toISOString(), payment_verified_by_admin_id: admin_id, payment_reference: reference_no || null } as any).eq("id", order_id);

    const { data: order } = await supabase.from("orders").select("*, tickets(id)").eq("id", order_id).single();
    if ((order as any)?.tickets?.length === 0) {
      for (let i = 0; i < (order as any).seats_count; i++) {
        const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
        const qrText = `T20FN-GATE-${order_id.slice(0, 8)}-S${i + 1}-${Date.now()}-${rand}`;
        await supabase.from("tickets").insert({ match_id: (order as any).match_id, event_id: (order as any).event_id, order_id, seat_index: i, qr_text: qrText, status: "active" });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
