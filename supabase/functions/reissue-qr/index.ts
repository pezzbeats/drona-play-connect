import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function generateSignedQR(matchId: string, mobile: string, seatIndex: number, secret: string): Promise<string> {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const payload = `T20FN-${matchId.slice(0, 8)}-${mobile}-S${seatIndex + 1}-${ts}-${rand}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16).toUpperCase();
  return `${payload}-SIG:${sigHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const hmacSecret = Deno.env.get("LOVABLE_API_KEY") || "fallback-secret";

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { ticket_id, admin_id } = await req.json();
    if (!ticket_id) throw new Error("ticket_id required");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch ticket with order details
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*, orders(purchaser_mobile, match_id)")
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket not found");
    if (ticket.status === "used") throw new Error("Cannot reissue QR for a checked-in ticket");

    const mobile = (ticket as any).orders?.purchaser_mobile;
    const matchId = (ticket as any).orders?.match_id;
    const oldQrText = ticket.qr_text;

    // Generate new HMAC-signed QR
    const newQrText = await generateSignedQR(matchId, mobile, ticket.seat_index, hmacSecret);

    // Update ticket with new QR (old QR is now dead)
    await supabase.from("tickets").update({ qr_text: newQrText } as any).eq("id", ticket_id);

    // Audit log
    const oldQrHash = await hashText(oldQrText);
    const newQrHash = await hashText(newQrText);
    await supabase.from("admin_activity").insert({
      admin_id: admin_id || user.id,
      action: "reissue_qr",
      entity_type: "ticket",
      entity_id: ticket_id,
      meta: { old_qr_hash: oldQrHash, new_qr_hash: newQrHash },
    });

    return new Response(JSON.stringify({ success: true, new_qr_text: newQrText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
