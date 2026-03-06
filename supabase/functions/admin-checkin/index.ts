import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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

    const { ticket_id, admin_id, regenerate } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await supabase.from("tickets").select("*, orders(purchaser_mobile, match_id, purchaser_full_name)").eq("id", ticket_id).single();
    if (!ticket) throw new Error("Ticket not found");

    const pin = generatePin();
    const pinHash = await hashPin(pin);
    const mobile = (ticket as any).orders?.purchaser_mobile;
    const matchId = (ticket as any).orders?.match_id;

    if (!regenerate) {
      await supabase.from("tickets").update({ status: "used", checked_in_at: new Date().toISOString(), checked_in_by_admin_id: admin_id } as any).eq("id", ticket_id);
    }

    await supabase.from("game_access").upsert({
      match_id: matchId, ticket_id, mobile, pin_hash: pinHash,
      pin_created_at: new Date().toISOString(), is_active: true,
      last_regenerated_by_admin_id: regenerate ? admin_id : null,
    }, { onConflict: "match_id,ticket_id" });

    return new Response(JSON.stringify({ pin, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
