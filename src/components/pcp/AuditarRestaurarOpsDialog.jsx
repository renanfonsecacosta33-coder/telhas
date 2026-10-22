import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Wrench
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  detectarMaquinaTelha,
  getItens
} from "@/lib/pedidoOdooHelper";
import { detectarCoresDuplaTelha } from "@/lib/autoBobinaTelhasHelper";
import { isCorCompativel } from "@/lib/bobinaValidation";
import { reajustarTodasBobinasMaquinasAutomaticamente } from "@/lib/reajusteAutomaticoBobinas";

const MAQUINAS_TELHAS_RECOLHER = [
  { id: "TP - 40", label: "TP - 40", cor: "bg-blue-500" },
  { id: "TP - 25", label: "TP - 25", cor: "bg-emerald-500" },
  { id: "ONDULADA", label: "Ondulada", cor: "bg-purple-500" },
  { id: "COLONIAL", label: "Colonial", cor: "bg-amber-500" },
  { id: "CUMEEIRA", label: "Cumeeira", cor: "bg-red-500" },
  { id: "BANDEJA", label: "Bandeja", cor: "bg-teal-500" },
  { id: "DESBOBINADOR", label: "Desbobinador / Slitter", cor: "bg-indigo-500" }
];

const MAQUINAS_CD_RECOLHER = [
  { id: "CORTE 3M", label: "Corte 3M" },
  { id: "CORTE 6M", label: "Corte 6M" },
  { id: "DOBRA 3M", label: "Dobra 3M" },
  { id: "DOBRA FUNDO 6M", label: "Dobra Fundo 6M" },
  { id: "DOBRA INICIO 6M", label: "Dobra Início 6M" },
  { id: "PERFILADEIRA", label: "Perfiladeira CD" }
];

export default function AuditarRestaurarOpsDialog({
  open,
  onOpenChange,
  onSucesso
}) {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  // Por padrão, seleciona todas as máquinas de telhas (exceto Colagem)
  const [maquinasSelecionadas, setMaquinasSelecionadas] = useState([
    "TP - 40", "TP - 25", "ONDULADA", "COLONIAL", "CUMEEIRA", "BANDEJA", "DESBOBINADOR"
  ]);

  const toggleMaquina = (maqId) => {
    setMaquinasSelecionadas(prev =>
      prev.includes(maqId) ? prev.filter(m => m !== maqId) : [...prev, maqId]
    );
  };

  const selecionarTodasTelhas = () => {
    setMaquinasSelecionadas(MAQUINAS_TELHAS_RECOLHER.map(m => m.id));
  };

  const selecionarTodasCD = () => {
    setMaquinasSelecionadas(MAQUINAS_CD_RECOLHER.map(m => m.id));
  };

  const selecionarTudo = () => {
    setMaquinasSelecionadas([
      ...MAQUINAS_TELHAS_RECOLHER.map(m => m.id),
      ...MAQUINAS_CD_RECOLHER.map(m => m.id)
    ]);
  };

  const limparSelecao = () => {
    setMaquinasSelecionadas([]);
  };

  const executarAuditoria = async () => {
    setExecutando(true);
    setResultado(null);

    const logs = [];
    let opsCorrigidas = 0;
    let opsTotal = 0;

    try {
      // 1. Limpa resquícios de bobina montada no localStorage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith("bobina_montada_") || key.startsWith("setup_bobina_") || key.includes("bobina_instalada")) {
            localStorage.removeItem(key);
          }
        });
        logs.push({
          tipo: "reset_setup",
          pedido: "SISTEMA",
          mensagem: "Memória local de bobinas montadas em máquinas limpa com sucesso."
        });
      } catch (errLs) {
        console.warn("[Auditoria] Erro ao limpar localStorage:", errLs);
      }

      // 2. Carrega todas as OPs de produção, Pedidos Odoo e Catálogo de Bobinas
      const [todasOps, todosPedidosOdoo, todasBobinas] = await Promise.all([
        base44.entities.Pedido.list("-created_date", 500).catch(() => []),
        base44.entities.PedidoOdoo.list("-data_recebimento", 1000).catch(() => []),
        base44.entities.Bobina.filter({ arquivada: false }).catch(() => [])
      ]);

      opsTotal = todasOps.length;

      // Cria mapa rápido de Pedidos Odoo por numero_pedido normalizado
      const mapOdoo = new Map();
      todosPedidosOdoo.forEach(p => {
        if (!p) return;
        const numPuro = String(p.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
        if (numPuro) mapOdoo.set(numPuro, p);
        if (p.of_nome) mapOdoo.set(String(p.of_nome).trim().toUpperCase(), p);
        if (p.of_odoo_id) mapOdoo.set(String(p.of_odoo_id).trim().toUpperCase(), p);
      });

      // 3. Itera sobre cada OP e audita inconsistências
      for (const op of todasOps) {
        if (!op || !op.id) continue;
        const numOpPuro = String(op.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
        const pedOdoo = mapOdoo.get(numOpPuro) || mapOdoo.get(String(op.of_nome || "").toUpperCase());

        const updates = {};
        const motivos = [];

        // --- REGRA A: RESTAURAÇÃO DE MODELO CORROMPIDO (Ex: "TP - 40 Galvalume", "TP - 25 TP - 25") ---
        let modeloEsperado = null;
        const textoOp = `${op.item_produto || ""} ${op.observacoes || ""}`.trim();
        if (pedOdoo) {
          const itens = getItens(pedOdoo);
          const primeiroItem = itens[0];
          if (primeiroItem) {
            const textoItemOdoo = `${primeiroItem.produto || ""} ${primeiroItem.descricao || ""} ${pedOdoo.descricao || ""} ${pedOdoo.observacoes || ""}`.trim();
            modeloEsperado = primeiroItem.modelo || detectarMaquinaTelha(textoItemOdoo);
          }
        }
        if (!modeloEsperado) {
          modeloEsperado = detectarMaquinaTelha(textoOp);
        }

        // Se o modelo ou máquina da OP difere do modelo real especificado no pedido do Odoo
        if (modeloEsperado && (op.modelo !== modeloEsperado || op.maquina !== modeloEsperado)) {
          const maqAnterior = op.maquina || op.modelo;
          updates.modelo = modeloEsperado;
          updates.maquina = modeloEsperado;
          if (op.observacoes && op.observacoes.includes("Auto-Roteado PCP")) {
            updates.observacoes = op.observacoes.replace(/Auto-Roteado PCP \([^)]+\)/, `Auto-Roteado PCP (${modeloEsperado})`);
          }
          motivos.push(`Máquina/Modelo restaurado de "${maqAnterior}" para "${modeloEsperado}" conforme pedido Odoo`);
        }

        // --- REGRA B: TELHA DUPLA (SANDUÍCHE) COM BOBINA INFERIOR CORROMPIDA/DUPLICADA ---
        const ehDuplaTelha = op.produto === "TELHA + EPS + TELHA" ||
          (pedOdoo && /(dupla|sanduiche|\+\s*telha)/i.test(pedOdoo.descricao || pedOdoo.observacoes || ""));

        if (ehDuplaTelha) {
          const textoCompleto = `${op.item_produto || ""} ${op.observacoes || ""} ${pedOdoo?.descricao || ""} ${pedOdoo?.observacoes || ""}`;
          const cores = detectarCoresDuplaTelha(op.item_produto || pedOdoo?.descricao || "", textoCompleto);

          // Se a cor inferior for diferente de NATURAL (ex: PRETO, BRANCO)
          if (cores.corInferior && cores.corInferior !== "NATURAL") {
            const bobinaSupId = op.bobina_superior_id;
            const bobinaInfId = op.bobina_inferior_id;

            // Se a bobina inferior foi clonada da superior ou está vazia ou tem cor errada
            const bobinaInferiorAtual = todasBobinas.find(b => b.id === bobinaInfId);
            const precisaCorrigirInferior =
              !op.bobina_inferior_manual && (
                !bobinaInfId ||
                (bobinaSupId && bobinaInfId === bobinaSupId) ||
                (bobinaInferiorAtual && !isCorCompativel(bobinaInferiorAtual.cor, cores.corInferior))
              );

            if (precisaCorrigirInferior) {
              // Busca no estoque a bobina correta da cor inferior (ex: PRETA TE0217)
              const candidatasInferior = todasBobinas.filter(b => {
                if (b.arquivada) return false;
                const corOk = isCorCompativel(b.cor, cores.corInferior);
                return corOk;
              });

              // Ordena priorizando bobinas já abertas/em uso e com código compatível
              candidatasInferior.sort((a, b) => {
                const aAberta = (a.status === "em_uso" || a.status === "aberta") ? 0 : 1;
                const bAberta = (b.status === "em_uso" || b.status === "aberta") ? 0 : 1;
                return aAberta - bAberta;
              });

              // Caso específico do Pedido S01148: TE0217 Preta
              const bobinaEspecifica1148 = candidatasInferior.find(b =>
                (b.codigo_bobina || b.codigo || "").toUpperCase().includes("TE0217") ||
                (b.descricao || "").toUpperCase().includes("TE0217")
              );

              const eleitaInferior = (numOpPuro.includes("1148") && bobinaEspecifica1148)
                ? bobinaEspecifica1148
                : candidatasInferior[0];

              if (eleitaInferior) {
                updates.bobina_inferior_id = eleitaInferior.id;
                updates.bobina_inferior = eleitaInferior.descricao || `${eleitaInferior.codigo_bobina} ${eleitaInferior.cor}`;
                updates.rvm_inferior = eleitaInferior.cor || cores.corInferior;
                motivos.push(
                  `Chapa Inferior corrigida: Bobina ${updates.bobina_inferior} (Cor: ${cores.corInferior})`
                );
              }
            }
          }
        }

        // --- REGRA C: CUMEEIRA ATRIBUÍDA A MÁQUINA DE TELHAS ---
        const ehCumeeira = op.produto === "CUMEEIRA" ||
          /\bCUMEEIRA\b/i.test(`${op.item_produto || ""} ${op.modelo || ""}`);
        if (ehCumeeira && op.maquina !== "CUMEEIRA") {
          updates.produto = "CUMEEIRA";
          updates.maquina = "CUMEEIRA";
          updates.eps = "";
          updates.eps_status = null;
          motivos.push(`Movido para a máquina CUMEEIRA`);
        }

        // --- REGRA D: TELHA SIMPLES COM RESÍDUOS DE EPS/COLAGEM ---
        const ehTelhaSimples = op.produto === "TELHA" && !ehDuplaTelha && !ehCumeeira;
        if (ehTelhaSimples && (op.eps || op.eps_status || op.maquina === "COLAGEM")) {
          updates.eps = "";
          updates.eps_status = null;
          updates.isopor_utilizado = null;
          if (op.maquina === "COLAGEM") {
            updates.maquina = op.maquina_origem || modeloEsperado || "TP - 25";
          }
          motivos.push(`Removidos resíduos indevidos de EPS/Colagem`);
        }

        // --- REGRA E: TELHA NO DESBOBINADOR ---
        const ehQualquerTelha = op.produto === "TELHA" || String(op.produto || "").toUpperCase().startsWith("TELHA") || op.produto === "CUMEEIRA";
        if (ehQualquerTelha && (op.maquina === "DESBOBINADOR" || op.modelo === "DESBOBINADOR")) {
          const maqAlvo = modeloEsperado && modeloEsperado !== "DESBOBINADOR" ? modeloEsperado : (detectarMaquinaTelha(textoOp) || "TP - 40");
          updates.maquina = maqAlvo;
          updates.modelo = maqAlvo;
          if (!op.maquina_origem || op.maquina_origem === "DESBOBINADOR") {
            updates.maquina_origem = maqAlvo;
          }
          motivos.push(`Telha no DESBOBINADOR realocada para perfiladeira "${maqAlvo}"`);
        }

        // Se houve correções para esta OP, aplica no banco
        if (Object.keys(updates).length > 0) {
          try {
            await base44.entities.Pedido.update(op.id, updates);
            opsCorrigidas++;
            logs.push({
              tipo: "op_corrigida",
              pedido: op.numero_pedido || `#${op.id.slice(0, 6)}`,
              cliente: op.cliente || pedOdoo?.cliente_nome || "—",
              maquina: op.maquina,
              motivos
            });
          } catch (errUpd) {
            console.error(`[Auditoria] Falha ao atualizar OP ${op.id}:`, errUpd);
          }
        }
      }

      // 4. Executa reajuste automático de bobinas trazidas do Odoo
      const resReajuste = await reajustarTodasBobinasMaquinasAutomaticamente();
      if (resReajuste?.detalhes?.length > 0) {
        resReajuste.detalhes.forEach(d => {
          opsCorrigidas++;
          logs.push({
            tipo: "bobina_reajustada",
            pedido: d.numero_pedido,
            cliente: d.cliente || "—",
            maquina: d.maquina,
            motivos: d.motivos
          });
        });
      }

      setResultado({
        opsTotal,
        opsCorrigidas,
        logs,
        sucesso: true
      });

      if (opsCorrigidas > 0) {
        toast.success(`Auditoria concluída! ${opsCorrigidas} OP(s) corrigidas e restauradas com sucesso.`);
      } else {
        toast.info(`Auditoria concluída! Todas as ${opsTotal} OPs analisadas estão consistentes.`);
      }

      if (onSucesso) onSucesso();
    } catch (e) {
      console.error("[Auditoria Brutal] Erro geral:", e);
      toast.error("Erro durante a auditoria de pedidos: " + (e?.message || ""));
    } finally {
      setExecutando(false);
    }
  };

  // ── RECOLHIMENTO E RESET DAS MÁQUINAS (Limpeza da Fila) ──
  const recolherEResetarMaquinas = async () => {
    if (maquinasSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma máquina para recolher os pedidos.");
      return;
    }

    const nomesMaqs = maquinasSelecionadas.join(", ");
    if (!window.confirm(
      "⚠️ DESALOCAÇÃO DAS MÁQUINAS SELECIONADAS\n\n" +
      `Máquinas selecionadas para recolhimento: ${nomesMaqs}\n\n` +
      "• Os pedidos ativos nestas máquinas voltarão para a Fila do PCP.\n" +
      "• ⛔ EXCEÇÃO CRÍTICA: A COLAGEM permanecerá 100% INTACTA.\n" +
      "• Pedidos finalizados e faturados NÃO serão alterados.\n\n" +
      "Deseja confirmar o recolhimento agora?"
    )) return;

    setExecutando(true);
    setResultado(null);
    const logs = [];
    const contagemPorMaquina = {};
    let recolhidosTelhas = 0;
    let recolhidosCD = 0;
    let preservadosColagem = 0;
    let preservadosFinalizados = 0;
    let opsCanceladasOrfas = 0;

    try {
      // 1. Limpa travas locais de setup de bobina
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith("bobina_montada_") || key.startsWith("setup_bobina_") || key.includes("bobina_instalada")) {
            localStorage.removeItem(key);
          }
        });
      } catch {}

      // 2. Carrega OPs locais (Telhas e CD) e Pedidos Odoo
      const [todasOpsTelhas, todasOpsCD, todosPedidosOdoo] = await Promise.all([
        base44.entities.Pedido.list("-created_date", 1000).catch(() => []),
        base44.entities.OrdemMaquinaCD ? base44.entities.OrdemMaquinaCD.list("-data", 1000).catch(() => []) : [],
        base44.entities.PedidoOdoo.list("-data_recebimento", 1000).catch(() => [])
      ]);

      const mapOdoo = new Map();
      todosPedidosOdoo.forEach(p => {
        if (!p) return;
        const numPuro = String(p.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
        if (numPuro) mapOdoo.set(numPuro, p);
      });

      const todayIso = new Date().toISOString().slice(0, 10);

      // ── ETAPA A: RECOLHIMENTO TELHAS (TP-40, TP-25, ONDULADA, COLONIAL, CUMEEIRA, BANDEJA, DESBOBINADOR) ──
      for (const op of todasOpsTelhas) {
        if (!op || !op.id) continue;

        // Se já finalizado: Preserva
        if (op.status === "finalizado") {
          preservadosFinalizados++;
          continue;
        }
        if (op.status === "cancelado") continue;

        const maqNome = String(op.maquina || "").toUpperCase();
        const maqNorm = maqNome.replace(/[^A-Z0-9]/g, "");

        // ⛔ 1. EXCEÇÃO CRÍTICA OBRIGATÓRIA: COLAGEM NUNCA É ALTERADA!
        if (maqNorm === "COLAGEM" || op.status === "aguardando_colagem") {
          preservadosColagem++;
          logs.push({
            tipo: "preservado_colagem",
            pedido: op.numero_pedido || op.id,
            cliente: op.cliente,
            vendedor: op.vendedor || op.vendedor_nome,
            maquina: "COLAGEM",
            mensagem: "⛔ PRESERVADO INTACTO NA COLAGEM (Exceção Crítica)."
          });
          continue;
        }

        // Filtra estritamente pelas máquinas selecionadas pelo usuário
        const estaNaSelecao = maquinasSelecionadas.some(
          m => m.toUpperCase().replace(/[^A-Z0-9]/g, "") === maqNorm
        );
        if (!estaNaSelecao) {
          continue;
        }

        const numOpPuro = String(op.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
        const pedOdoo = mapOdoo.get(numOpPuro);

        // Se a OP é órfã (sem pedido Odoo correspondente)
        if (!pedOdoo) {
          await base44.entities.Pedido.update(op.id, {
            status: "cancelado",
            data_finalizacao: todayIso,
            observacoes: (op.observacoes || "") + " [Cancelado: OP Órfã / Reset PCP]"
          });
          opsCanceladasOrfas++;
          logs.push({
            tipo: "orfa",
            pedido: op.numero_pedido || op.id,
            cliente: op.cliente,
            maquina: op.maquina || "Telhas",
            mensagem: "OP órfã cancelada e removida da máquina."
          });
          continue;
        }

        // Se o pedido no Odoo já foi concluído ou faturado, mantém intacto
        const pedStatus = String(pedOdoo.status || pedOdoo.status_pcp || "").toLowerCase();
        if (pedStatus === "concluido" || pedStatus === "faturado") {
          preservadosFinalizados++;
          continue;
        }

        // Cancela a OP ativa na máquina
        await base44.entities.Pedido.update(op.id, {
          status: "cancelado",
          data_finalizacao: todayIso,
          observacoes: (op.observacoes || "") + " [Recolhido para Central PCP]"
        });

        // Reseta os itens do PedidoOdoo para ficarem pendentes de máquina no PCP
        const itens = getItens(pedOdoo);
        let alterou = false;
        const itensZerados = itens.map(it => {
          if (it.status !== "concluido") {
            alterou = true;
            return {
              ...it,
              status: "pendente",
              status_detalhado: "Pendente de Distribuição",
              concluido: false,
              distribuido: false,
              maquina: ""
            };
          }
          return it;
        });

        if (alterou) {
          await base44.entities.PedidoOdoo.update(pedOdoo.id, {
            itens_json: JSON.stringify(itensZerados),
            status_pcp: "pendente_distribuicao",
            distribuido: false
          });
        }

        recolhidosTelhas++;
        const maqChave = op.maquina || "TP - 40";
        contagemPorMaquina[maqChave] = (contagemPorMaquina[maqChave] || 0) + 1;

        logs.push({
          tipo: "recolhido",
          pedido: op.numero_pedido,
          cliente: op.cliente || pedOdoo.cliente_nome,
          vendedor: op.vendedor || pedOdoo.vendedor_nome,
          maquina: op.maquina,
          mensagem: `OP #${op.numero_pedido} recolhida de ${op.maquina} para a Central PCP.`
        });
      }

      // ── ETAPA B: RECOLHIMENTO CORTE E DOBRA ──
      for (const op of todasOpsCD) {
        if (!op || !op.id) continue;

        if (op.status === "finalizado") {
          preservadosFinalizados++;
          continue;
        }
        if (op.status === "cancelado") continue;

        const maqNomeCD = String(op.maquina || "").toUpperCase();
        const maqNormCD = maqNomeCD.replace(/[^A-Z0-9]/g, "");

        const estaNaSelecaoCD = maquinasSelecionadas.some(
          m => m.toUpperCase().replace(/[^A-Z0-9]/g, "") === maqNormCD
        );
        if (!estaNaSelecaoCD) {
          continue;
        }

        const numOpPuro = String(op.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
        const pedOdoo = mapOdoo.get(numOpPuro);

        // Se a OP é órfã
        if (!pedOdoo) {
          await base44.entities.OrdemMaquinaCD.update(op.id, {
            status: "cancelado",
            data_finalizacao: todayIso,
            observacao: (op.observacao || "") + " [Cancelado: OP Órfã / Reset PCP]"
          });
          opsCanceladasOrfas++;
          continue;
        }

        const pedStatus = String(pedOdoo.status || pedOdoo.status_pcp || "").toLowerCase();
        if (pedStatus === "concluido" || pedStatus === "faturado") {
          preservadosFinalizados++;
          continue;
        }

        // Cancela a OP da máquina de CD
        await base44.entities.OrdemMaquinaCD.update(op.id, {
          status: "cancelado",
          data_finalizacao: todayIso,
          observacao: (op.observacao || "") + " [Recolhido para Central PCP]"
        });

        // Reseta os itens do PedidoOdoo
        const itens = getItens(pedOdoo);
        let alterou = false;
        const itensZerados = itens.map(it => {
          if (it.status !== "concluido") {
            alterou = true;
            return {
              ...it,
              status: "pendente",
              status_detalhado: "Pendente de Distribuição",
              concluido: false,
              distribuido: false,
              maquina: ""
            };
          }
          return it;
        });

        if (alterou) {
          await base44.entities.PedidoOdoo.update(pedOdoo.id, {
            itens_json: JSON.stringify(itensZerados),
            status_pcp: "pendente_distribuicao",
            distribuido: false
          });
        }

        recolhidosCD++;
        const maqChave = op.maquina || "CORTE 3M";
        contagemPorMaquina[maqChave] = (contagemPorMaquina[maqChave] || 0) + 1;

        logs.push({
          tipo: "recolhido",
          pedido: op.numero_pedido,
          cliente: op.cliente || pedOdoo.cliente_nome,
          vendedor: op.vendedor || pedOdoo.vendedor_nome,
          maquina: op.maquina,
          mensagem: `OP #${op.numero_pedido} recolhida de ${op.maquina} para a Central PCP.`
        });
      }

      setResultado({
        tipo: "reset_geral",
        opsTotal: todasOpsTelhas.length + todasOpsCD.length,
        opsRecolhidas: recolhidosTelhas + recolhidosCD,
        recolhidosTelhas,
        recolhidosCD,
        preservadosColagem,
        preservadosFinalizados,
        opsCanceladasOrfas,
        contagemPorMaquina,
        logs
      });

      toast.success(
        `Desalocação concluída! ${recolhidosTelhas + recolhidosCD} pedido(s) devolvidos ao PCP. ${preservadosColagem} preservados na Colagem.`
      );
      if (onSucesso) onSucesso();
    } catch (err) {
      console.error("[Reset Geral] Erro:", err);
      toast.error("Erro ao resetar máquinas: " + (err?.message || ""));
    } finally {
      setExecutando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Auditoria Brutal & Restauração de Pedidos e Bobinas
          </DialogTitle>
          <DialogDescription>
            Varredura profunda em todas as Ordens de Produção (OPs) para restaurar modelos originais do Odoo e corrigir bobinas de telhas duplas (sanduíche).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Card Explicativo das Ações */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2.5">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-orange-500" />
              O que esta auditoria executa:
            </h4>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                <strong className="text-foreground">Restaura Modelos:</strong> Remove sufixos corrompidos (ex: <em>"TP - 40 Galvalume"</em>) e restaura para o modelo limpo (<em>TP - 25, TP - 40, Colonial</em>) baseado no pedido original do Odoo.
              </li>
              <li>
                <strong className="text-foreground">Telhas Duplas (Sanduíche):</strong> Localiza pedidos com faces diferentes (ex: Superior Natural e Inferior Preta, como a OP <strong>#S01148</strong>) e desvincula a duplicação, vinculando a bobina correta do estoque (<strong>TE0217 Preta</strong>).
              </li>
              <li>
                <strong className="text-foreground">Limpeza de Telhas Simples:</strong> Remove qualquer resíduo indevido de EPS ou colagem em telhas convencionais.
              </li>
              <li>
                <strong className="text-foreground">Reset de Bobina em Máquina:</strong> Limpa travas e caches de bobinas montadas em máquinas do sistema.
              </li>
            </ul>
          </div>

          {/* Botão 1: Auditoria & Restauração de Modelos */}
          <div className="flex items-center justify-between p-4 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl">
            <div>
              <p className="text-xs font-bold text-orange-900 dark:text-orange-200">
                Auditar & Restaurar Modelos Odoo
              </p>
              <p className="text-[11px] text-orange-700/80 dark:text-orange-300/80">
                Corrige modelos corrompidos e repara bobinas de telhas duplas.
              </p>
            </div>
            <Button
              onClick={executarAuditoria}
              disabled={executando}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-9 px-4 text-xs gap-1.5 shrink-0 cursor-pointer"
            >
              {executando ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Auditando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Executar Auditoria
                </>
              )}
            </Button>
          </div>

          {/* Botão 2: Seletor de Máquinas e Recolhimento Operacional */}
          <div className="p-4 bg-red-50/80 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900/60 rounded-xl space-y-3.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-black text-red-950 dark:text-red-100 flex items-center gap-1.5">
                  <span className="text-base">🔄</span> Escolher Máquinas para Devolver ao PCP
                </p>
                <p className="text-xs text-red-800/80 dark:text-red-300/80">
                  Marque as máquinas cujos pedidos devem retornar para a Fila do PCP para reauditoria.
                </p>
              </div>

              {/* Atalhos Rápidos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selecionarTodasTelhas}
                  className="h-7 text-[11px] font-bold border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 hover:bg-red-100/60"
                >
                  Todas Telhas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selecionarTodasCD}
                  className="h-7 text-[11px] font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Corte & Dobra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={limparSelecao}
                  className="h-7 text-[11px] font-medium text-muted-foreground hover:bg-slate-100"
                >
                  Limpar
                </Button>
              </div>
            </div>

            {/* Grid 1: Máquinas de Telhas */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                🏭 Setor Fábrica de Telhas:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {MAQUINAS_TELHAS_RECOLHER.map(m => {
                  const ativa = maquinasSelecionadas.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMaquina(m.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition-all text-left cursor-pointer ${
                        ativa
                          ? "bg-red-600 text-white border-red-700 shadow-2xs ring-1 ring-red-500"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[10px] font-black">{ativa ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ⛔ Alerta de Exceção da Colagem */}
            <div className="p-2.5 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
              <span className="flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Bancada de COLAGEM:</span>
                <span className="font-normal">PROTEGIDA (Pedidos na Colagem NUNCA são recolhidos).</span>
              </span>
              <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-black">
                Intacta
              </Badge>
            </div>

            {/* Grid 2: Máquinas de Corte e Dobra */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                ✂️ Setor Corte e Dobra (Opcional):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {MAQUINAS_CD_RECOLHER.map(m => {
                  const ativa = maquinasSelecionadas.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMaquina(m.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition-all text-left cursor-pointer ${
                        ativa
                          ? "bg-purple-600 text-white border-purple-700 shadow-2xs ring-1 ring-purple-500"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[10px] font-black">{ativa ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botão de Disparo */}
            <div className="pt-1 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {maquinasSelecionadas.length === 0 ? (
                  <span className="text-red-600 font-semibold">Nenhuma máquina marcada</span>
                ) : (
                  <span><strong>{maquinasSelecionadas.length}</strong> máquina(s) selecionada(s) para recolher</span>
                )}
              </span>

              <Button
                onClick={recolherEResetarMaquinas}
                disabled={executando || maquinasSelecionadas.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold h-9 px-4 text-xs gap-1.5 shrink-0 cursor-pointer shadow-sm"
              >
                {executando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Recolhendo...
                  </>
                ) : (
                  <>
                    <span>↩️ Devolver Selecionadas ao PCP</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Resultados da Execução */}
          {resultado && (
            <div className="space-y-3 pt-2">
              {resultado.tipo === "reset_geral" ? (
                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-black text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Relatório de Desalocação em Massa
                    </span>
                    <Badge className="bg-blue-600 text-white font-bold text-xs">
                      {resultado.opsRecolhidas} Pedidos Devolvidos ao PCP
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] text-muted-foreground uppercase font-sans">Telhas</p>
                      <p className="text-base font-black text-orange-600">{resultado.recolhidosTelhas} OPs</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] text-muted-foreground uppercase font-sans">Corte & Dobra</p>
                      <p className="text-base font-black text-purple-600">{resultado.recolhidosCD} OPs</p>
                    </div>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-300 dark:border-emerald-800">
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-sans font-bold">⛔ Na Colagem</p>
                      <p className="text-base font-black text-emerald-700 dark:text-emerald-200">{resultado.preservadosColagem} Intactos</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] text-muted-foreground uppercase font-sans">Concluídos</p>
                      <p className="text-base font-black text-slate-700 dark:text-slate-300">{resultado.preservadosFinalizados} Intactos</p>
                    </div>
                  </div>

                  {resultado.contagemPorMaquina && Object.keys(resultado.contagemPorMaquina).length > 0 && (
                    <div className="pt-1.5 border-t border-blue-200/60 dark:border-blue-900/40">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Desalocação por Máquina:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(resultado.contagemPorMaquina).map(([maq, qtd]) => (
                          <Badge key={maq} variant="outline" className="text-[11px] font-bold bg-white dark:bg-slate-900">
                            {maq}: <span className="ml-1 text-orange-600">{qtd}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Auditoria Concluída: {resultado.opsTotal} OPs analisadas
                  </span>
                  <Badge variant={resultado.opsCorrigidas > 0 ? "default" : "secondary"} className="text-xs">
                    {resultado.opsCorrigidas} OP(s) Corrigida(s)
                  </Badge>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {resultado.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-foreground">
                        #{log.pedido} {log.cliente && `· ${log.cliente}`}
                      </span>
                      {log.maquina && (
                        <Badge variant="outline" className="text-[10px]">
                          {log.maquina}
                        </Badge>
                      )}
                    </div>
                    {log.mensagem && (
                      <p className="text-[11px] text-muted-foreground">{log.mensagem}</p>
                    )}
                    {log.motivos && (
                      <ul className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium list-disc list-inside space-y-0.5">
                        {log.motivos.map((m, mIdx) => (
                          <li key={mIdx}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}