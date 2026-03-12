import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', caller.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Apenas administradores podem gerenciar usuários' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { action = 'create' } = body;

    if (action === 'create') {
      const { email, password, role, name, phone, vehicle_plate } = body;

      if (!email || !password || !role) {
        throw new Error('Email, senha e tipo são obrigatórios');
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      await supabaseAdmin.from('user_roles').insert({ user_id: userId, role });

      // Create profile for all users
      await supabaseAdmin.from('profiles').insert({
        user_id: userId,
        name: name || null,
        phone: phone || null,
      });

      // If patroller, also create patroller record
      if (role === 'patroller' && name) {
        await supabaseAdmin.from('patrollers').insert({
          user_id: userId, name, phone, vehicle_plate,
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) throw new Error('user_id é obrigatório');
      if (user_id === caller.id) throw new Error('Não é possível excluir a própria conta');

      await supabaseAdmin.from('patrollers').delete().eq('user_id', user_id);
      await supabaseAdmin.from('profiles').delete().eq('user_id', user_id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_users') {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;

      const { data: roles } = await supabaseAdmin.from('user_roles').select('*');
      const { data: patrollers } = await supabaseAdmin.from('patrollers').select('*');
      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');

      const userList = (roles || []).map(r => {
        const authUser = users.find(u => u.id === r.user_id);
        const patroller = (patrollers || []).find(p => p.user_id === r.user_id);
        const profile = (profiles || []).find(p => p.user_id === r.user_id);
        return {
          id: r.user_id,
          email: authUser?.email || '',
          role: r.role,
          patroller_id: patroller?.id || null,
          patroller_name: patroller?.name || null,
          phone: patroller?.phone || profile?.phone || null,
          vehicle_plate: patroller?.vehicle_plate || null,
          profile_name: profile?.name || null,
        };
      });

      return new Response(JSON.stringify({ users: userList }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_user') {
      const { user_id, email: newEmail, phone: newPhone, name: newName, vehicle_plate: newPlate } = body;
      if (!user_id) throw new Error('user_id é obrigatório');

      // Update auth email if provided
      if (newEmail) {
        // Check for duplicate email
        const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();
        const duplicate = allUsers?.find(u => u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== user_id);
        if (duplicate) {
          throw new Error('Este email já está em uso por outro usuário');
        }
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email: newEmail, email_confirm: true });
        if (authErr) throw authErr;
      }

      // Update profile
      await supabaseAdmin.from('profiles').upsert({
        user_id,
        name: newName ?? null,
        phone: newPhone ?? null,
      }, { onConflict: 'user_id' });

      // Update patroller if exists
      const { data: patroller } = await supabaseAdmin.from('patrollers').select('id').eq('user_id', user_id).maybeSingle();
      if (patroller) {
        await supabaseAdmin.from('patrollers').update({
          name: newName ?? undefined,
          phone: newPhone ?? null,
          vehicle_plate: newPlate ?? null,
        }).eq('user_id', user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_password') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) throw new Error('user_id e new_password são obrigatórios');
      if (new_password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres');

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (authErr) throw authErr;

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Ação inválida');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
