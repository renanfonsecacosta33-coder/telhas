import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const equipe = allUsers
      .filter(u => ['admin', 'super_admin', 'gestor', 'vendedor'].includes(u.role))
      .filter(u => u.id !== user.id)
      .map(u => ({
        id: u.id,
        full_name: u.full_name || u.email || 'Usuário',
        email: u.email || '',
        role: u.role || 'user',
      }));

    return Response.json({ equipe });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});