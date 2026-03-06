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
    const { ticket_id, admin_id, regenerate } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get ticket + order
    const { data: ticket } = await supabase.from("tickets").select("*, orders(purchaser_mobile, match_id, purchaser_full_name)").eq("id", ticket_id).single();
    if (!ticket) throw new Error("Ticket not found");

    const pin = generatePin();
    const pinHash = await hashPin(pin);
    const mobile = (ticket as any).orders?.purchaser_mobile;
    const matchId = (ticket as any).orders?.match_id;

    if (!regenerate) {
      // Mark ticket as used (checked in)
      await supabase.from("tickets").update({ status: "used", checked_in_at: new Date().toISOString(), checked_in_by_admin_id: admin_id } as any).eq("id", ticket_id);
    }

    // Upsert game_access record
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
