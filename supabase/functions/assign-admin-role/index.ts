import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify the calling admin is super_admin
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: callerRoleRow } = await adminClient
    .from('admin_roles')
    .select('role')
    .eq('user_id', caller.id)
    .maybeSingle();

  if (callerRoleRow?.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — super_admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { action, email, user_id, role } = body;

  // ── DELETE role ──────────────────────────────────────────────────────────────
  if (action === 'remove') {
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    await adminClient.from('admin_roles').delete().eq('user_id', user_id);
    await adminClient.from('admin_activity').insert({
      admin_id: caller.id,
      action: 'remove_admin_role',
      entity_type: 'admin_roles',
      meta: { target_user_id: user_id },
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── UPDATE / ASSIGN role ─────────────────────────────────────────────────────
  if (action === 'assign') {
    const validRoles = ['super_admin', 'operator', 'gate_staff'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetUserId = user_id;

    // Look up by email if no user_id provided
    if (!targetUserId && email) {
      const { data: users, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) {
        return new Response(JSON.stringify({ error: 'Failed to list users' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const found = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (!found) {
        return new Response(JSON.stringify({ error: `No user found with email: ${email}` }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetUserId = found.id;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'email or user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert (update if exists, insert if new)
    const { error: upsertErr } = await adminClient
      .from('admin_roles')
      .upsert({ user_id: targetUserId, role }, { onConflict: 'user_id' });

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient.from('admin_activity').insert({
      admin_id: caller.id,
      action: 'assign_admin_role',
      entity_type: 'admin_roles',
      meta: { target_user_id: targetUserId, role },
    });

    return new Response(JSON.stringify({ ok: true, user_id: targetUserId, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── LIST users (admins + all auth users for the picker) ──────────────────────
  if (action === 'list_users') {
    const { data: users, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) {
      return new Response(JSON.stringify({ error: 'Failed to list users' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const slim = users.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }));
    return new Response(JSON.stringify({ users: slim }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
