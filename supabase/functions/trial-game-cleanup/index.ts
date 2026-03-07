import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    // Service role client for deletes bypassing RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { match_id } = await req.json();
    if (!match_id) return new Response(JSON.stringify({ error: 'match_id required' }), { status: 400, headers: corsHeaders });

    // Safety: verify this is actually a trial match
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('id, name')
      .eq('id', match_id)
      .single();

    if (matchError || !matchRow) {
      return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404, headers: corsHeaders });
    }

    if (!matchRow.name.startsWith('[TRIAL]')) {
      return new Response(JSON.stringify({ error: 'Safety guard: match name must start with [TRIAL]' }), { status: 403, headers: corsHeaders });
    }

    // Collect team IDs from roster before deleting anything
    const { data: rosterRows } = await supabase.from('match_roster').select('team_id').eq('match_id', match_id);
    const teamIds = (rosterRows || []).map((r: any) => r.team_id).filter(Boolean);

    // Collect order IDs for seat pricing cleanup
    const { data: orderRows } = await supabase.from('orders').select('id').eq('match_id', match_id);
    const orderIds = (orderRows || []).map((r: any) => r.id).filter(Boolean);

    // Delete in dependency order
    await supabase.from('predictions').delete().eq('match_id', match_id);
    await supabase.from('leaderboard').delete().eq('match_id', match_id);
    await supabase.from('prediction_windows').delete().eq('match_id', match_id);
    await supabase.from('deliveries').delete().eq('match_id', match_id);
    await supabase.from('over_control').delete().eq('match_id', match_id);
    await supabase.from('match_live_state').delete().eq('match_id', match_id);
    await supabase.from('match_flags').delete().eq('match_id', match_id);
    await supabase.from('match_scoring_config').delete().eq('match_id', match_id);
    await supabase.from('game_access').delete().eq('match_id', match_id);
    await supabase.from('match_lineup').delete().eq('match_id', match_id);
    await supabase.from('match_roster').delete().eq('match_id', match_id);
    await supabase.from('match_assets').delete().eq('match_id', match_id);

    // Cleanup orders and related data
    if (orderIds.length > 0) {
      await supabase.from('ticket_scan_log').delete().in('match_id', [match_id]);
      await supabase.from('tickets').delete().eq('match_id', match_id);
      await supabase.from('order_seat_pricing').delete().in('order_id', orderIds);
      await supabase.from('orders').delete().eq('match_id', match_id);
    } else {
      await supabase.from('tickets').delete().eq('match_id', match_id);
    }

    await supabase.from('matches').delete().eq('id', match_id);

    // Delete dummy players + teams (only trial teams — name starts with [TRIAL])
    if (teamIds.length > 0) {
      const { data: teamRows } = await supabase.from('teams').select('id, name').in('id', teamIds);
      const trialTeamIds = (teamRows || []).filter((t: any) => t.name.startsWith('[TRIAL]')).map((t: any) => t.id);
      if (trialTeamIds.length > 0) {
        await supabase.from('players').delete().in('team_id', trialTeamIds);
        await supabase.from('teams').delete().in('id', trialTeamIds);
      }
    }

    return new Response(JSON.stringify({ success: true, match_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('trial-game-cleanup error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
