import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    let bobinaId = url.searchParams.get("bobina_id");

    if (!bobinaId) {
      try {
        const body = await req.json();
        bobinaId = body?.bobina_id;
      } catch (e) {}
    }

    if (!bobinaId) {
      return Response.json({ error: "bobina_id é obrigatório" }, { status: 400 });
    }

    const bobina = await base44.asServiceRole.entities.Bobina.get(bobinaId);
    if (!bobina) {
      return Response.json({ error: "Bobina não encontrada" }, { status: 404 });
    }

    let ordensDesbob = [];
    let ordensMaquina = [];
    let solicitacoesReserva = [];
    try {
      ordensDesbob = await base44.asServiceRole.entities.OrdemDesbobinadeira.filter({ bobina_id: bobinaId }, "-data", 200);
    } catch (e) {}
    try {
      ordensMaquina = await base44.asServiceRole.entities.OrdemMaquinaCD.filter({ bobina_id: bobinaId }, "-data", 200);
    } catch (e) {}
    try {
      solicitacoesReserva = await base44.asServiceRole.entities.SolicitacaoReserva.filter({ bobina_id: bobinaId }, "-created_date", 50);
    } catch (e) {}

    return Response.json({ bobina, ordensDesbob, ordensMaquina, solicitacoesReserva });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});