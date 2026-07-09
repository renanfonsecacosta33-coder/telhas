import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Suporta chamada direta (via automation) ou manual
    const pedido = body.data || body.pedido;
    const pedidoId = body.event?.entity_id || body.pedido_id;

    if (!pedido && !pedidoId) {
      return Response.json({ error: 'Pedido não fornecido' }, { status: 400 });
    }

    // Busca o pedido se não veio no payload
    let ped = pedido;
    if (!ped && pedidoId) {
      ped = await base44.asServiceRole.entities.Pedido.get(pedidoId);
    }

    if (!ped) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const descontos = [];

    // ── BOBINAS (superior + inferior) ─────────────────────────────────────────
    // Suporta desconto por variação (cada item com sua própria bobina) ou modo legado
    let variacoesTelhas = [];
    try { variacoesTelhas = JSON.parse(ped.variacoes_telhas || "[]"); } catch { variacoesTelhas = []; }
    const hasVarBobinas = Array.isArray(variacoesTelhas) && variacoesTelhas.some(v => v.bobina_id);

    if (hasVarBobinas) {
      // Modo variações: desconta cada bobina individualmente, agrupando por bobina_id
      const precisaInf = ["TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(ped.produto);
      const deduzirPorBobina = async (idField, tipo) => {
        const kgPorBobina = {};
        for (const v of variacoesTelhas) {
          const q = Number(v.qty) || 0;
          const mm = Number(v.mm) || 0;
          const metros = q * mm / 1000;
          const bid = v[idField];
          if (metros <= 0 || !bid) continue;
          if (!kgPorBobina[bid]) {
            const bob = await base44.asServiceRole.entities.Bobina.get(bid);
            kgPorBobina[bid] = { kg: 0, chapa: Number(bob?.chapa) || 0, bob };
          }
          if (kgPorBobina[bid].chapa > 0) kgPorBobina[bid].kg += kgPorBobina[bid].chapa * metros;
        }
        for (const [bid, d] of Object.entries(kgPorBobina)) {
          if (d.kg > 0 && d.bob) {
            const novoPeso = Math.max(0, (d.bob.peso_kg || 0) - d.kg);
            await base44.asServiceRole.entities.Bobina.update(bid, { peso_kg: +novoPeso.toFixed(1) });
            descontos.push({ tipo, id: bid, kg_descontado: +d.kg.toFixed(1) });
          }
        }
      };
      await deduzirPorBobina('bobina_id', 'bobina_variacao');
      if (precisaInf) await deduzirPorBobina('bobina_inf_id', 'bobina_inf_variacao');
    } else {
      // Modo legado: bobina única superior
      if (ped.bobina_superior_id && ped.kg_superior) {
        const bobina = await base44.asServiceRole.entities.Bobina.get(ped.bobina_superior_id);
        if (bobina) {
          const novoPeso = Math.max(0, (bobina.peso_kg || 0) - ped.kg_superior);
          const novaMetragem = ped.metragem_utilizada
            ? Math.max(0, (bobina.metragem_restante || bobina.metragem || 0) - ped.metragem_utilizada)
            : (bobina.metragem_restante || bobina.metragem || 0);

          const updateData = { peso_kg: +novoPeso.toFixed(1) };
          if (novaMetragem !== undefined) updateData.metragem_restante = +novaMetragem.toFixed(1);

          await base44.asServiceRole.entities.Bobina.update(ped.bobina_superior_id, updateData);
          descontos.push({ tipo: 'bobina_superior', id: ped.bobina_superior_id, kg_descontado: ped.kg_superior });
        }
      }
      // Modo legado: bobina única inferior
      if (ped.bobina_inferior_id && ped.kg_inferior) {
        const bobina = await base44.asServiceRole.entities.Bobina.get(ped.bobina_inferior_id);
        if (bobina) {
          const novoPeso = Math.max(0, (bobina.peso_kg || 0) - ped.kg_inferior);
          await base44.asServiceRole.entities.Bobina.update(ped.bobina_inferior_id, {
            peso_kg: +novoPeso.toFixed(1),
          });
          descontos.push({ tipo: 'bobina_inferior', id: ped.bobina_inferior_id, kg_descontado: ped.kg_inferior });
        }
      }
    }

    // ── 3. ISOPOR ─────────────────────────────────────────────────────────────
    const precisaEPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(ped.produto);
    if (precisaEPS && ped.isopor_utilizado && ped.eps) {
      // Busca o estoque de isopor pelo tipo
      const isoporList = await base44.asServiceRole.entities.Isopor.filter({ tipo: ped.eps });
      if (isoporList && isoporList.length > 0) {
        const iso = isoporList[0];
        const novaQtd = Math.max(0, (iso.quantidade || 0) - ped.isopor_utilizado);
        const novaMetragem = Math.max(0, (iso.metragem_total || 0) - (ped.isopor_utilizado * 2));
        await base44.asServiceRole.entities.Isopor.update(iso.id, {
          quantidade: Math.round(novaQtd),
          metragem_total: +novaMetragem.toFixed(1),
        });
        descontos.push({ tipo: 'isopor', id: iso.id, pecas_descontadas: ped.isopor_utilizado });
      }
    }

    // ── 4. MANTA (se produto tiver MANTA) ────────────────────────────────────
    if (ped.produto === "TELHA + EPS + MANTA" && ped.metros) {
      const mantas = await base44.asServiceRole.entities.Produto.filter({ categoria: "Consumivel", nome: "Manta" });
      if (mantas && mantas.length > 0) {
        const manta = mantas[0];
        const novaQtd = Math.max(0, (manta.quantidade || 0) - ped.metros);
        await base44.asServiceRole.entities.Produto.update(manta.id, { quantidade: +novaQtd.toFixed(1) });
        descontos.push({ tipo: 'manta', id: manta.id, metros_descontados: ped.metros });
      }
    }

    // ── 5. COLA (se houver em estoque — qualquer produto cola) ────────────────
    // Cola é descontada por metros usando ~0.05 kg/m como padrão
    if (precisaEPS && ped.metros) {
      const colas = await base44.asServiceRole.entities.Produto.filter({ categoria: "Cola" });
      if (colas && colas.length > 0) {
        const cola = colas[0]; // usa o primeiro disponível
        const kgCola = +(ped.metros * 0.05).toFixed(2); // 50g por metro
        const novaQtd = Math.max(0, (cola.quantidade || 0) - kgCola);
        await base44.asServiceRole.entities.Produto.update(cola.id, { quantidade: +novaQtd.toFixed(2) });
        descontos.push({ tipo: 'cola', id: cola.id, kg_descontado: kgCola });
      }
    }

    // Marca o pedido com data de finalização se não tiver
    if (!ped.data_finalizacao) {
      await base44.asServiceRole.entities.Pedido.update(ped.id || pedidoId, {
        data_finalizacao: new Date().toISOString().split('T')[0],
      });
    }

    return Response.json({ success: true, descontos, pedido_id: ped.id || pedidoId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});