import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    let userScopedCount = -1;
    let userScopedError = null;
    let sampleUserScoped = [];
    try {
      const res = await base44.entities.Bobina.list("-created_date", 2000);
      const arr = Array.isArray(res) ? res : (res && res.items) || [];
      userScopedCount = arr.length;
      sampleUserScoped = arr.slice(0, 3).map(b => ({ codigo: b.codigo, setor: b.setor, unidade: b.unidade, arquivada: b.arquivada }));
    } catch (e) {
      userScopedError = String(e && e.message ? e.message : e).slice(0, 300);
    }
    let serviceCount = -1;
    let serviceError = null;
    try {
      serviceCount = await base44.asServiceRole.entities.Bobina.count();
    } catch (e) {
      serviceError = String(e && e.message ? e.message : e).slice(0, 300);
    }
    return Response.json({
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      userScopedCount,
      userScopedError,
      sampleUserScoped,
      serviceCount,
      serviceError
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}