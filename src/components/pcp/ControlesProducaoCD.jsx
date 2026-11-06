import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Play, Plus, Wrench } from "lucide-react";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { opDaMesmaOf } from "@/lib/opVinculoSeguro";
import { maquinasCDPorFilial } from "@/lib/maquinasPorFilial";
import { hojeLocalISO } from "@/lib/dataLocal";
import OpCDControleLinha from "@/components/pcp/OpCDControleLinha";

const ATIVOS = ["pendente", "aguardando_corte", "em_producao", "pausado"];

/**
 * Produção de Corte e Dobra direto na Central PCP (Ivaiporã).
 * Lista as OPs de máquina da OF com controles individuais (iniciar, pausar,
 * retomar e finalizar com foto) e permite iniciar novas peças — várias em paralelo.
 */
export default function ControlesProducaoCD({ pedido, ordensCD = [] }) {
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [maquina, setMaquina] = useState("LASER");
  const [itemIdx, setItemIdx] = useState("0");
  const [salvando, setSalvando] = useState(false);

  const itensCD = useMemo(() => getItens(pedido).filter((it) => classGrupo(it) === "cd" && it.concluido !== true), [pedido]);

  const ops = useMemo(() => {
    const lista = (ordensCD || []).filter((o) => o && o.status !== "cancelado");
    const vinculoExato = (o) => opDaMesmaOf(o, pedido);
    const num = String(pedido?.numero_pedido || "").trim();
    const legado = (o) =>
      !!num &&
      String(o.numero_pedido || "").trim() === num &&
      !o.pedido_odoo_id && !o.of_odoo_id && !o.of_nome;
    return lista.filter((o) => (vinculoExato(o) || legado(o)) && ATIVOS.includes(o.status || "pendente"));
  }, [ordensCD, pedido]);

  const recarregar = () => {
    ["ordens-cd-todos", "ordens-maquina-cd-todas", "ordens-maquina-cd", "ordens-maquinas-cd", "pedidos-odoo-pcp"].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const salvarOp = async (op, patch) => {
    try {
      await base44.entities.OrdemMaquinaCD.update(op.id, {
        ...patch,
        ...(op.pedido_odoo_id ? {} : {
          pedido_odoo_id: pedido.id,
          of_odoo_id: pedido.of_odoo_id || null,
          of_nome: pedido.of_nome || null,
        }),
      });
      recarregar();
    } catch (e) {
      toast.error("Erro ao atualizar a produção: " + (e?.message || ""));
      throw e;
    }
  };

  const iniciarNova = async () => {
    const item = itensCD[Number(itemIdx) || 0];
    if (!item) {
      toast.error("Nenhum item de Corte e Dobra pendente nesta OF.");
      return;
    }
    setSalvando(true);
    try {
      await base44.entities.OrdemMaquinaCD.create({
        unidade: pedido.unidade || "Ivaiporã",
        data: hojeLocalISO(),
        maquina,
        tipo_peca: item.produto || item.descricao || "Peça",
        dimensoes_livres: item.medida || item.medicao || "",
        quantidade: Number(item.quantidade) || 1,
        numero_pedido: pedido.numero_pedido,
        numero_oc: pedido.numero_oc || "",
        cliente: pedido.cliente_nome || pedido.cliente || "",
        vendedor: pedido.vendedor_nome || pedido.vendedor || "",
        pedido_odoo_id: pedido.id,
        of_odoo_id: pedido.of_odoo_id || null,
        of_nome: pedido.of_nome || null,
        item_idx: item._idx ?? null,
        itens_indices: JSON.stringify(item._idx != null ? [item._idx] : []),
        item_produto: item.produto || null,
        status: "em_producao",
        inicio_producao_ts: new Date().toISOString(),
        observacoes: "Iniciada pela Central PCP (Ivaiporã).",
      });
      recarregar();
      toast.success(`Produção iniciada na ${maquina}.`);
      setCriando(false);
    } catch (e) {
      toast.error("Erro ao iniciar produção: " + (e?.message || ""));
    } finally {
      setSalvando(false);
    }
  };

  const maquinas = maquinasCDPorFilial("Ivaiporã");
  const semNada = ops.length === 0 && itensCD.length === 0;
  if (semNada) return null;

  return (
    <div
      className="mt-1 rounded-[10px] border border-[#f3dcc6] dark:border-orange-900 bg-[#fdf7f1] dark:bg-orange-950/25 px-3 py-2 flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#9a5b23] dark:text-orange-300">
          <Wrench className="w-3 h-3" /> Produção aqui · Corte e Dobra
        </span>
        {!criando && itensCD.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setCriando(true)} className="h-6 gap-1 text-[10px] px-2">
            <Plus className="w-3 h-3" /> Iniciar peça
          </Button>
        )}
      </div>

      {ops.map((op) => (
        <OpCDControleLinha key={op.id} op={op} pedido={pedido} onSalvar={salvarOp} />
      ))}

      {criando && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Select value={String(itemIdx)} onValueChange={setItemIdx}>
            <SelectTrigger className="h-7 w-[230px] text-[11px] bg-white dark:bg-slate-900">
              <SelectValue placeholder="Escolher peça..." />
            </SelectTrigger>
            <SelectContent>
              {itensCD.map((it, i) => (
                <SelectItem key={it._idx ?? i} value={String(i)} className="text-xs">
                  {it.produto || it.descricao || "Peça"} · {it.quantidade ?? "?"} {it.unidade || ""}
                  {it.medida ? ` · ${it.medida}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={maquina} onValueChange={setMaquina}>
            <SelectTrigger className="h-7 w-[160px] text-[11px] bg-white dark:bg-slate-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {maquinas.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={iniciarNova} disabled={salvando} className="h-7 gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
            <Play className="w-3 h-3" /> Iniciar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCriando(false)} className="h-7 text-[11px]">
            Cancelar
          </Button>
        </div>
      )}

      {ops.length === 0 && !criando && (
        <span className="text-[10.5px] text-[#8a6a4a] dark:text-orange-300/80">
          Nenhuma peça em produção nesta máquina — clique em “Iniciar peça”.
        </span>
      )}
    </div>
  );
}