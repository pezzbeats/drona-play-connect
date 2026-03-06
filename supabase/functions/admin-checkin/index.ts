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

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Verify HMAC-SHA256 signature on QR text. Backward-compatible: old tickets without -SIG: pass. */
async function verifyQrSignature(qrText: string, secret: string): Promise<{ valid: boolean; tampered: boolean }> {
  const sigIdx = qrText.lastIndexOf("-SIG:");
  if (sigIdx === -1) {
    // Old ticket — grace period, allow through
    return { valid: true, tampered: false };
  }

  const payload = qrText.slice(0, sigIdx);
  const providedSig = qrText.slice(sigIdx + 5).toUpperCase();

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16)
      .toUpperCase();

    if (expectedSig !== providedSig) {
      return { valid: false, tampered: true };
    }
    return { valid: true, tampered: false };
  } catch {
    return { valid: false, tampered: true };
  }
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

    const { ticket_id, admin_id, regenerate, qr_text } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch ticket first (needed for match_id freeze check)
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, orders(purchaser_mobile, match_id, purchaser_full_name)")
      .eq("id", ticket_id)
      .single();
    if (!ticket) throw new Error("Ticket not found");

    const matchId = (ticket as any).orders?.match_id;

    // ── Check panic flag: scanning frozen ──
    if (matchId) {
      const { data: flags } = await supabase
        .from("match_flags")
        .select("scanning_frozen")
        .eq("match_id", matchId)
        .maybeSingle();

      if (flags?.scanning_frozen) {
        return new Response(
          JSON.stringify({ error: "Gate scanning is currently frozen by admin. Please contact your supervisor." }),
          { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- HMAC signature verification (if QR text provided) ---
    if (qr_text) {
      const { valid, tampered } = await verifyQrSignature(qr_text, hmacSecret);
      if (!valid || tampered) {
        // Log tampered scan attempt
        const qrHash = await hashText(qr_text);
        await supabase.from("ticket_scan_log").insert({
          qr_text_hash: qrHash,
          ticket_id: ticket_id || null,
          scanned_by_admin_id: admin_id || user.id,
          outcome: "tampered",
        } as any);
        return new Response(
          JSON.stringify({ error: "QR signature invalid — possible tampering detected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const pin = generatePin();
    const pinHash = await hashPin(pin);
    const mobile = (ticket as any).orders?.purchaser_mobile;

    if (!regenerate) {
      await supabase.from("tickets").update({
        status: "used",
        checked_in_at: new Date().toISOString(),
        checked_in_by_admin_id: admin_id
      } as any).eq("id", ticket_id);
    }

    await supabase.from("game_access").upsert({
      match_id: matchId, ticket_id, mobile, pin_hash: pinHash,
      pin_created_at: new Date().toISOString(), is_active: true,
      last_regenerated_by_admin_id: regenerate ? admin_id : null,
    }, { onConflict: "match_id,ticket_id" });

    // Log successful check-in
    const qrHash = qr_text ? await hashText(qr_text) : await hashText(ticket_id);
    await supabase.from("ticket_scan_log").insert({
      qr_text_hash: qrHash,
      ticket_id,
      match_id: matchId,
      scanned_by_admin_id: admin_id || user.id,
      outcome: regenerate ? "pin_regen" : "ok",
    } as any);

    return new Response(JSON.stringify({ pin, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
