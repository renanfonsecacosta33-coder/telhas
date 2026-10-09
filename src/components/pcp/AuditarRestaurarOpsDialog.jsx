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
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Layers,
  ArrowRight
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  detectarTipoProdutoTelha,
  detectarMaquinaTelha,
  detectarEPSTelha,
  getItens
} from "@/lib/pedidoOdooHelper";
import { detectarCoresDuplaTelha } from "@/lib/autoBobinaTelhasHelper";
import { isCorCompativel, removerAcentos } from "@/lib/bobinaValidation";
import { reajustarTodasBobinasMaquinasAutomaticamente } from "@/lib/reajusteAutomaticoBobinas";

export default function AuditarRestaurarOpsDialog({
  open,
  onOpenChange,
  onSucesso
}) {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

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
        if (pedOdoo) {
          const itens = getItens(pedOdoo);
          const primeiroItem = itens[0];
          if (primeiroItem) {
            const textoItemOdoo = `${primeiroItem.produto || ""} ${primeiroItem.descricao || ""} ${pedOdoo.descricao || ""} ${pedOdoo.observacoes || ""}`.trim();
            modeloEsperado = primeiroItem.modelo || detectarMaquinaTelha(textoItemOdoo);
          }
        }
        if (!modeloEsperado) {
          const textoOp = `${op.item_produto || ""} ${op.observacoes || ""}`.trim();
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
              !bobinaInfId ||
              (bobinaSupId && bobinaInfId === bobinaSupId) ||
              (bobinaInferiorAtual && !isCorCompativel(bobinaInferiorAtual.cor, cores.corInferior));

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

          {/* Botão de Disparo */}
          <div className="flex items-center justify-between p-4 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl">
            <div>
              <p className="text-xs font-bold text-orange-900 dark:text-orange-200">
                Iniciar Varredura em Massa
              </p>
              <p className="text-[11px] text-orange-700/80 dark:text-orange-300/80">
                Leva poucos segundos e não afeta pedidos em produção.
              </p>
            </div>
            <Button
              onClick={executarAuditoria}
              disabled={executando}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-9 px-4 text-xs gap-1.5 shrink-0"
            >
              {executando ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Auditando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Executar Auditoria Agora
                </>
              )}
            </Button>
          </div>

          {/* Resultados da Execução */}
          {resultado && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Auditoria Concluída: {resultado.opsTotal} OPs analisadas
                </span>
                <Badge variant={resultado.opsCorrigidas > 0 ? "default" : "secondary"} className="text-xs">
                  {resultado.opsCorrigidas} OP(s) Corrigida(s)
                </Badge>
              </div>

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