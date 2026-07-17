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
      o = await base44.asServiceRole.entities.OrdemDesbobinadeira.get(ordemId);
    }

    if (!o) {
      return Response.json({ error: 'Ordem não encontrada' }, { status: 404 });
    }

    // Só processa se estiver finalizada
    if (o.status !== 'finalizado') {
      return Response.json({ success: true, message: 'Ordem não está finalizada' });
    }

    const descontos = [];

    // Desconta KG da bobina e cria ChapaCD no estoque
    if (o.bobina_id) {
      const bobina = await base44.asServiceRole.entities.Bobina.get(o.bobina_id).catch(() => null);
      if (bobina) {
        // Desconta KG
        const pesoADescontar = o.peso_real_balanca_kg > 0 ? o.peso_real_balanca_kg : (o.kg_estimado || 0);
        if (pesoADescontar > 0) {
          const novoPeso = Math.max(0, (bobina.peso_kg || 0) - pesoADescontar);
          await base44.asServiceRole.entities.Bobina.update(o.bobina_id, {
            peso_kg: +novoPeso.toFixed(1),
          });
          descontos.push({ tipo: 'bobina', id: o.bobina_id, kg_descontado: pesoADescontar, novo_peso: novoPeso });
        }

        // Gera código automático CH0001, CH0002 ...
        const todasChapas = await base44.asServiceRole.entities.ChapaCD.list("-created_date", 500).catch(() => []);
        let maxNum = 0;
        todasChapas.forEach(c => {
          const m = c.codigo && c.codigo.match(/^CH(\d+)$/i);
          if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
        });
        const novoCodigo = `CH${String(maxNum + 1).padStart(4, "0")}`;

        const pesoFinal = o.peso_real_balanca_kg > 0 ? o.peso_real_balanca_kg : (o.kg_estimado || 0);
        const espessuraChapa = bobina.espessura_real ? Number(bobina.espessura_real) : (bobina.chapa ? Number(bobina.chapa) : null);

        const hist = [{
          data: new Date().toISOString(),
          usuario: "Desbobinadeira",
          motivo: o.peso_real_balanca_kg > 0 ? "Criada com Pesagem Real na Balança" : "Criada com Peso Estimado (Teórico)",
          qtd_antes: 0,
          qtd_depois: o.quantidade || 0,
          peso_kg: pesoFinal,
          foto_url: o.foto_finalizacao_url || null
        }];

        // Cria ChapaCD no estoque da Chaparia
        const chapaCriada = await base44.asServiceRole.entities.ChapaCD.create({
          codigo: novoCodigo,
          origem: "desbobinadeira",
          ordem_id: o.id,
          bobina_id: o.bobina_id,
          bobina_descricao: o.bobina_descricao || "",
          qualidade: bobina.qualidade || null,
          espessura_mm: espessuraChapa,
          comprimento_mm: o.comprimento_mm || 0,
          largura_mm: bobina.largura_mm || 0,
          quantidade_total: o.quantidade || 0,
          quantidade_disponivel: o.quantidade || 0,
          peso_kg: pesoFinal,
          destino: o.destino === "pedido_direto" ? "pedido_direto" : "estoque",
          numero_pedido: o.numero_pedido || null,
          cliente: o.cliente || null,
          data_corte: o.data_finalizacao || o.data || new Date().toISOString().split('T')[0],
          status: "disponivel",
          foto_finalizacao_url: o.foto_finalizacao_url || null,
          foto_pedido_url: o.foto_pedido_url || null,
          observacoes: o.observacoes || null,
          historico_movimentacoes: JSON.stringify(hist),
        });
        descontos.push({ tipo: 'chapa_cd_criada', id: chapaCriada.id, codigo: novoCodigo });

        // Se for pedido direto com guilhotina definida, cria OP automática na guilhotina
        if (o.destino === "pedido_direto" && o.guilhotina && chapaCriada?.id) {
          const chapaDesc = `${novoCodigo} — ${o.bobina_descricao || ""} ${o.comprimento_mm || 0}mm`.trim();
          const opCriada = await base44.asServiceRole.entities.OrdemMaquinaCD.create({
            data: o.data_finalizacao || o.data || new Date().toISOString().split('T')[0],
            maquina: o.guilhotina,
            chapa_cd_id: chapaCriada.id,
            chapa_descricao: chapaDesc,
            chapa_origem: "chaparia",
            tipo_peca: "Corte Guilhotina",
            dimensoes_livres: o.tamanho_corte_guilhotina ? `CORTE ${o.tamanho_corte_guilhotina}mm` : null,
            numero_pedido: o.numero_pedido || null,
            cliente: o.cliente || null,
            vendedor: o.vendedor || null,
            quantidade: o.quantidade || 0,
            status: "pendente",
            foto_pedido_url: o.foto_pedido_url || null,
            foto_material_url: o.foto_finalizacao_url || null,
            observacoes: o.observacoes
              ? `${o.observacoes}\n— OP gerada automaticamente pela Desbobinadeira (OP ${o.id.slice(-6).toUpperCase()})`
              : `OP gerada automaticamente pela Desbobinadeira (OP ${o.id.slice(-6).toUpperCase()})`,
          });
          descontos.push({ tipo: 'op_maquina_criada', id: opCriada.id, maquina: o.guilhotina });
        }
      }
    }

    return Response.json({ success: true, descontos });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
