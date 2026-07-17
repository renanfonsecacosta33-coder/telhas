import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const ordem = body.data || body.ordem;
    const ordemId = body.event?.entity_id || body.ordem_id;

    if (!ordem && !ordemId) {
      return Response.json({ error: 'Ordem não fornecida' }, { status: 400 });
    }

    let o = ordem;
    if (!o && ordemId) {
      o = await base44.asServiceRole.entities.OrdemMaquinaCD.get(ordemId);
    }

    if (!o) {
      return Response.json({ error: 'Ordem não encontrada' }, { status: 404 });
    }

    // Só processa se estiver finalizada
    if (o.status !== 'finalizado') {
      return Response.json({ success: true, message: 'Ordem não está finalizada' });
    }

    const descontos = [];

    // 1. Baixa automatizada no estoque de chaparia (ChapaCD)
    if (o.chapa_origem === 'chaparia' && o.chapa_cd_id && o.quantidade > 0) {
      const chapa = await base44.asServiceRole.entities.ChapaCD.get(o.chapa_cd_id).catch(() => null);
      if (chapa) {
        const novaQtd = Math.max(0, (chapa.quantidade_disponivel || 0) - o.quantidade);
        await base44.asServiceRole.entities.ChapaCD.update(o.chapa_cd_id, {
          quantidade_disponivel: novaQtd,
          status: novaQtd === 0 ? "consumido" : chapa.status,
        });
        descontos.push({ tipo: 'chapa_cd', id: o.chapa_cd_id, quantidade_descontada: o.quantidade, nova_quantidade: novaQtd });
      }
    }

    // 2. Desconto direto na bobina (se chapa_origem === direto)
    if (o.chapa_origem === 'direto' && o.bobina_id && o.peso_kg > 0) {
      const bobina = await base44.asServiceRole.entities.Bobina.get(o.bobina_id).catch(() => null);
      if (bobina) {
        const novoPeso = Math.max(0, (bobina.peso_kg || 0) - o.peso_kg);
        await base44.asServiceRole.entities.Bobina.update(o.bobina_id, {
          peso_kg: +novoPeso.toFixed(1),
        });
        descontos.push({ tipo: 'bobina', id: o.bobina_id, kg_descontado: o.peso_kg, novo_peso: novoPeso });
      }
    }

    // 3. Se for uma ordem de corte, desbloquear a dobra vinculada e repassar OBD
    if (o.ordem_dobra_maquina) {
      const ordensDobra = await base44.asServiceRole.entities.OrdemMaquinaCD.filter({
        ordem_corte_id: o.id,
        status: "aguardando_corte"
      }).catch(() => []);
      for (const od of ordensDobra) {
        const updateData: any = { status: "pendente" };
        if (o.modificacao_blank && o.modificacao_descricao) {
          const obsDobra = `OBD: ${o.modificacao_descricao}`;
          updateData.observacoes = od.observacoes
            ? `${od.observacoes}\n${obsDobra}`
            : obsDobra;
        }
        await base44.asServiceRole.entities.OrdemMaquinaCD.update(od.id, updateData);
        descontos.push({ tipo: 'dobra_desbloqueada', id: od.id });
      }
    }

    return Response.json({ success: true, descontos });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
