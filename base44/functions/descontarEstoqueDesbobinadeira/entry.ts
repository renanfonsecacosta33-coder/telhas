import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const ordem = body.data || body.ordem;
    const ordemId = body.event?.entity_id || body.ordem_id;

    if (!ordem && !ordemId) {
      return Response.json({ error: 'Ordem não fornecida' }, { status: 400 });
    }

    let o = ordem;
    if (!o && ordemId) {
      o = await base44.asServiceRole.entities.OrdemDesbobinadeira.get(ordemId).catch(() => null);
    }

    if (!o) {
      return Response.json({ error: 'Ordem não encontrada' }, { status: 404 });
    }

    // Só processa se estiver finalizada
    if (o.status !== 'finalizado') {
      return Response.json({ success: true, message: 'Ordem não está finalizada' });
    }

    // Idempotência: verificar se já existe ChapaCD criada para esta ordem
    const chapasExistentes = await base44.asServiceRole.entities.ChapaCD.filter({ ordem_id: o.id }).catch(() => []);
    if (chapasExistentes && chapasExistentes.length > 0) {
      return Response.json({
        success: true,
        message: 'Chapa já havia sido gerada para esta ordem',
        chapa: chapasExistentes[0]
      });
    }

    const descontos: any[] = [];
    let bobina: any = null;

    if (o.bobina_id) {
      bobina = await base44.asServiceRole.entities.Bobina.get(o.bobina_id).catch(() => null);
    }

    // Desconta peso da bobina se existir
    if (bobina) {
      const pesoADescontar = Number(o.peso_real_balanca_kg) > 0 ? Number(o.peso_real_balanca_kg) : (Number(o.kg_estimado) || 0);
      if (pesoADescontar > 0) {
        const pesoAtual = Number(bobina.peso_kg) || 0;
        const novoPeso = Math.max(0, pesoAtual - pesoADescontar);
        await base44.asServiceRole.entities.Bobina.update(bobina.id, {
          peso_kg: +novoPeso.toFixed(1),
        }).catch((e) => console.error("Erro ao abater peso da bobina:", e));
        descontos.push({ tipo: 'bobina', id: bobina.id, kg_descontado: pesoADescontar, novo_peso: novoPeso });
      }
    }

    // Gera código sequencial automático CH0001, CH0002 ...
    const todasChapas = await base44.asServiceRole.entities.ChapaCD.list("-created_date", 500).catch(() => []);
    let maxNum = 0;
    todasChapas.forEach((c: any) => {
      const m = c.codigo && c.codigo.match(/^CH(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const novoCodigo = `CH${String(maxNum + 1).padStart(4, "0")}`;

    const pesoFinal = Number(o.peso_real_balanca_kg) > 0 ? Number(o.peso_real_balanca_kg) : (Number(o.kg_estimado) || 0);

    // Parsing robusto de espessura (aceita vírgula ou ponto: "1,95" ou 1.95)
    let espessuraChapa: number | null = null;
    const rawEsp = o.espessura_utilizada || bobina?.espessura_real || bobina?.chapa;
    if (rawEsp != null) {
      const parsed = parseFloat(String(rawEsp).replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) espessuraChapa = parsed;
    }

    const unidadeFabril = o.unidade || bobina?.unidade || "Matriz AJL";
    const larguraMm = Number(bobina?.largura_mm) || Number(o.largura_mm) || 1204;
    const qualidadeChapa = bobina?.qualidade || "GV";
    const materialChapa = bobina?.cor || bobina?.material || "Chapa lisa";

    const hist = [{
      data: new Date().toISOString(),
      usuario: "Desbobinadeira",
      motivo: Number(o.peso_real_balanca_kg) > 0 ? "Criada com Pesagem Real na Balança" : "Criada com Peso Estimado (Teórico)",
      qtd_antes: 0,
      qtd_depois: Number(o.quantidade) || 0,
      peso_kg: pesoFinal,
      foto_url: o.foto_finalizacao_url || null
    }];

    // Cria ChapaCD no estoque da Chaparia
    const chapaCriada = await base44.asServiceRole.entities.ChapaCD.create({
      codigo: novoCodigo,
      unidade: unidadeFabril,
      origem: "desbobinadeira",
      ordem_id: o.id,
      bobina_id: o.bobina_id || (bobina ? bobina.id : null),
      bobina_descricao: o.bobina_descricao || (bobina ? `[${bobina.codigo}] ${bobina.cor || ''} ${espessuraChapa ? espessuraChapa + 'mm' : ''}`.trim() : "Desbobinadeira"),
      qualidade: qualidadeChapa,
      material: materialChapa,
      espessura_mm: espessuraChapa,
      comprimento_mm: Number(o.comprimento_mm) || 0,
      largura_mm: larguraMm,
      quantidade_total: Number(o.quantidade) || 0,
      quantidade_disponivel: Number(o.quantidade) || 0,
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
        unidade: unidadeFabril,
        maquina: o.guilhotina,
        chapa_cd_id: chapaCriada.id,
        chapa_descricao: chapaDesc,
        chapa_origem: "chaparia",
        tipo_peca: "Corte Guilhotina",
        dimensoes_livres: o.tamanho_corte_guilhotina ? `CORTE ${o.tamanho_corte_guilhotina}mm` : null,
        numero_pedido: o.numero_pedido || null,
        cliente: o.cliente || null,
        vendedor: o.vendedor || null,
        quantidade: Number(o.quantidade) || 0,
        status: "pendente",
        foto_pedido_url: o.foto_pedido_url || null,
        foto_material_url: o.foto_finalizacao_url || null,
        observacoes: o.observacoes
          ? `${o.observacoes}\n— OP gerada automaticamente pela Desbobinadeira (OP ${o.id.slice(-6).toUpperCase()})`
          : `OP gerada automaticamente pela Desbobinadeira (OP ${o.id.slice(-6).toUpperCase()})`,
      });
      descontos.push({ tipo: 'op_maquina_criada', id: opCriada.id, maquina: o.guilhotina });
    }

    return Response.json({ success: true, chapa: chapaCriada, descontos });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});