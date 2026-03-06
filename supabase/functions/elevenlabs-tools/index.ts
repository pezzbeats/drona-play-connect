import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("elevenlabs-tools body:", JSON.stringify(body));

    // ElevenLabs may send tool_name or tool
    const toolName = body.tool_name || body.tool || body.name;
    const parameters = body.parameters || body.params || {};

    // ElevenLabs sends the tool name and parameters
    const params = parameters;

    let result: any;

    switch (toolName) {
      case "lookup_ticket": {
        // Check ticket/order status by mobile number
        const mobile = params.mobile?.toString().replace(/\D/g, "").slice(-10);
        if (!mobile) {
          result = { success: false, message: "Mobile number nahi mila. Kripya apna mobile number batayein." };
          break;
        }

        const { data: orders } = await supabase
          .from("orders")
          .select(`
            id, purchaser_full_name, purchaser_mobile, seats_count,
            payment_status, total_amount, created_at,
            matches(name, venue, start_time, status)
          `)
          .eq("purchaser_mobile", mobile)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!orders || orders.length === 0) {
          result = {
            success: true,
            found: false,
            message: `Is mobile number ${mobile} ke liye koi booking nahi mili. Kya aapne sahi number diya?`
          };
          break;
        }

        const latestOrder = orders[0];
        const match = latestOrder.matches as any;
        const statusMap: Record<string, string> = {
          paid_verified: "Payment confirm ho gayi hai ✅",
          paid_manual_verified: "Payment manually verify ho gayi hai ✅",
          pending_verification: "Payment verification pending hai ⏳",
          unpaid: "Payment abhi baaki hai ❌",
          paid_rejected: "Payment reject ho gayi hai ❌",
        };

        const { data: tickets } = await supabase
          .from("tickets")
          .select("id, status, seat_index")
          .eq("order_id", latestOrder.id);

        result = {
          success: true,
          found: true,
          name: latestOrder.purchaser_full_name,
          mobile: latestOrder.purchaser_mobile,
          seats: latestOrder.seats_count,
          amount_paid: `₹${latestOrder.total_amount}`,
          payment_status: statusMap[latestOrder.payment_status] || latestOrder.payment_status,
          match_name: match?.name || "N/A",
          venue: match?.venue || "Hotel Drona Palace, Kashipur",
          tickets_issued: tickets?.length || 0,
          ticket_status: tickets?.map((t: any) => t.status).join(", ") || "N/A",
          message: `${latestOrder.purchaser_full_name} ji, aapki booking ${match?.name || "match"} ke liye hai. Aapne ${latestOrder.seats_count} seat(s) book kiya hai. ${statusMap[latestOrder.payment_status] || ""}. Total: ₹${latestOrder.total_amount}.`
        };
        break;
      }

      case "get_match_info": {
        // Get current active match details
        const { data: matches } = await supabase
          .from("matches")
          .select(`
            id, name, venue, start_time, status, opponent, match_type,
            is_active_for_registration, predictions_enabled,
            events(name, venue)
          `)
          .in("status", ["registrations_open", "live", "registrations_closed"])
          .order("created_at", { ascending: false })
          .limit(5);

        if (!matches || matches.length === 0) {
          result = {
            success: true,
            found: false,
            message: "Abhi koi active match nahi hai. Jab match announce hoga, aapko website par dikhai dega."
          };
          break;
        }

        const activeMatch = matches.find((m: any) => m.is_active_for_registration) || matches[0];
        const event = activeMatch.events as any;

        const statusMap: Record<string, string> = {
          registrations_open: "Registration abhi open hai 🟢",
          registrations_closed: "Registration band ho gayi hai 🔴",
          live: "Match abhi live chal raha hai 🔴 LIVE",
          draft: "Jald hi announce hoga",
          ended: "Match khatam ho gaya",
        };

        const startTime = activeMatch.start_time
          ? new Date(activeMatch.start_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" })
          : "Time jald announce hoga";

        result = {
          success: true,
          match_name: activeMatch.name,
          opponent: activeMatch.opponent || "TBA",
          venue: activeMatch.venue || "Hotel Drona Palace, Kashipur",
          start_time: startTime,
          status: statusMap[activeMatch.status] || activeMatch.status,
          match_type: activeMatch.match_type,
          registrations_open: activeMatch.is_active_for_registration,
          event_name: event?.name || "T20 Fan Night",
          message: `${activeMatch.name} match ${activeMatch.venue || "Hotel Drona Palace"} mein hoga. ${startTime}. Status: ${statusMap[activeMatch.status] || activeMatch.status}.`
        };
        break;
      }

      case "get_pricing": {
        // Get ticket pricing for the active match
        const mobile = params.mobile?.toString().replace(/\D/g, "").slice(-10);

        const { data: activeMatch } = await supabase
          .from("matches")
          .select("id, name")
          .eq("is_active_for_registration", true)
          .single();

        if (!activeMatch) {
          result = {
            success: false,
            message: "Abhi koi active match nahi hai jiske liye pricing dekh sakein."
          };
          break;
        }

        const { data: pricingRule } = await supabase
          .from("match_pricing_rules")
          .select("base_price_new, base_price_returning, rule_type")
          .eq("match_id", activeMatch.id)
          .single();

        let isReturning = false;
        if (mobile) {
          const { data: pastOrders } = await supabase
            .from("orders")
            .select("id")
            .eq("purchaser_mobile", mobile)
            .neq("match_id", activeMatch.id)
            .in("payment_status", ["paid_verified", "paid_manual_verified"])
            .limit(1);
          isReturning = (pastOrders?.length || 0) > 0;
        }

        const newPrice = pricingRule?.base_price_new || 999;
        const returningPrice = pricingRule?.base_price_returning || newPrice;

        result = {
          success: true,
          match_name: activeMatch.name,
          new_customer_price: `₹${newPrice} per seat`,
          returning_customer_price: `₹${returningPrice} per seat`,
          is_returning_customer: mobile ? isReturning : null,
          your_price: mobile ? `₹${isReturning ? returningPrice : newPrice} per seat` : null,
          message: mobile
            ? `${activeMatch.name} ke liye ticket price: ${isReturning ? `Aap returning customer hain, aapke liye ₹${returningPrice} per seat hai` : `Naye customers ke liye ₹${newPrice} per seat hai`}. Family (2 seat) mein thoda discount mil sakta hai.`
            : `${activeMatch.name} ke liye ticket price naye customers ke liye ₹${newPrice} per seat hai. Purane customers ke liye ₹${returningPrice} per seat hai.`
        };
        break;
      }

      case "check_registration": {
        // Check if a mobile number is already registered
        const mobile = params.mobile?.toString().replace(/\D/g, "").slice(-10);

        const { data: activeMatchCR } = await supabase
          .from("matches")
          .select("id, name")
          .eq("is_active_for_registration", true)
          .maybeSingle();

        if (!activeMatchCR) {
          result = {
            success: false,
            message: "Abhi koi active match nahi hai registration ke liye."
          };
          break;
        }

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id, payment_status, seats_count, purchaser_full_name")
          .eq("purchaser_mobile", mobile)
          .eq("match_id", activeMatchCR.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingOrder) {
          const statusMap: Record<string, string> = {
            paid_verified: "confirm ho gayi hai ✅",
            paid_manual_verified: "confirm ho gayi hai ✅",
            pending_verification: "verification pending hai ⏳",
            unpaid: "payment abhi baaki hai ❌",
            paid_rejected: "reject ho gayi ❌",
          };
          result = {
            success: true,
            already_registered: true,
            name: existingOrder.purchaser_full_name,
            seats: existingOrder.seats_count,
            payment_status: existingOrder.payment_status,
            message: `Haan, is number se ${existingOrder.purchaser_full_name} ji ki booking already hai. ${existingOrder.seats_count} seat(s) ke liye payment ${statusMap[existingOrder.payment_status] || existingOrder.payment_status}.`
          };
        } else {
          result = {
            success: true,
            already_registered: false,
            match_name: activeMatchCR.name,
            message: `Is mobile number se ${activeMatchCR.name} ke liye koi registration nahi hai. Aap abhi register kar sakte hain website par jakar.`
          };
        }
        break;
      }

      default: {
        result = {
          success: false,
          message: `Tool "${tool}" nahi mila. Available tools: lookup_ticket, get_match_info, get_pricing, check_registration.`,
          available_tools: ["lookup_ticket", "get_match_info", "get_pricing", "check_registration"]
        };
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("elevenlabs-tools error:", e.message);
    return new Response(
      JSON.stringify({ success: false, message: "Kuch problem aa gayi. Please thodi der baad try karein." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
