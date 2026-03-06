import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateSignedQr(
  matchId: string,
  mobile: string,
  seatNo: number,
  secret: string,
): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now();
  const payload = `T20FN-${matchId.slice(0, 8)}-${mobile}-S${seatNo}-${ts}-${rand}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
    .toUpperCase();
  return `${payload}-SIG:${sigHex}`;
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
    const hmacSecret = Deno.env.get("LOVABLE_API_KEY") || "fallback-secret";

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { order_id, admin_id, method, amount, reference_no } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Record payment collection
    const { error: collectError } = await supabase.from("payment_collections").insert({
      order_id,
      collected_by_admin_id: admin_id,
      method,
      amount,
      reference_no: reference_no || null,
    });
    if (collectError) throw collectError;

    // Mark order as paid
    await supabase
      .from("orders")
      .update({
        payment_status: "paid_manual_verified",
        payment_verified_at: new Date().toISOString(),
        payment_verified_by_admin_id: admin_id,
        payment_reference: reference_no || null,
      } as any)
      .eq("id", order_id);

    // Fetch order (with existing tickets)
    const { data: order } = await supabase
      .from("orders")
      .select("*, tickets(id)")
      .eq("id", order_id)
      .single();

    // Generate HMAC-signed tickets if none exist yet
    if ((order as any)?.tickets?.length === 0) {
      const mobile = (order as any).purchaser_mobile || "unknown";
      for (let i = 0; i < (order as any).seats_count; i++) {
        const qrText = await generateSignedQr(
          (order as any).match_id,
          mobile,
          i + 1,
          hmacSecret,
        );
        await supabase.from("tickets").insert({
          match_id: (order as any).match_id,
          event_id: (order as any).event_id,
          order_id,
          seat_index: i,
          qr_text: qrText,
          status: "active",
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
