import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Layers, Circle, Search, CheckCircle2, AlertTriangle, Package, Scissors, X } from "lucide-react";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";
import { getItens, buildItensJson } from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";

export default function SelecionarMaterialPedidoDialog({
  open,
  onOpenChange,
  pedido,
  item,
  idx,
  onMaterialVinculado
}) {
  const [busca, setBusca] = useState("");
  const [abaMaterial, setAbaMaterial] = useState("chapas");
  const [selecionado, setSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [autorizaSubstituicao, setAutorizaSubstituicao] = useState(false);
  const [somenteCompativel, setSomenteCompativel] = useState(true);

  const queryClient = useQueryClient();
  const { filialAtiva, user } = useFilial();
  const isAdmin = ["admin", "super_admin", "gestor"].includes(user?.role);

  // Extrai com precisão a espessura da instrução do vendedor ou do produto
  let espessuraItem = item?.espessura ? String(item.espessura).replace(",", ".").trim() : "";
  if (!espessuraItem && (item?.descricao || item?.produto)) {
    const mEsp = String(item.descricao || item.produto).match(/\b(?:ch|chapa|esp|e)?\s*([0-9]+[.,][0-9]{1,2})\s*(?:mm|gi)?\b/i);
    if (mEsp) espessuraItem = mEsp[1].replace(",", ".");
  }
  const numEspItem = parseFloat(espessuraItem) || null;

  function getNumEsp(obj) {
    if (!obj) return null;
    const str = String(obj.espessura || obj.chapa || obj.espessura_real || obj.espessura_mm || obj.espessura_utilizada || "").replace(",", ".").replace(/[^\d.]/g, "");
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  // 1. Busca chapas de C&D compatíveis da unidade
  const { data: chapas = [], isLoading: loadingChapas } = useQuery({
    queryKey: ["chapas-selecao-pcp", filialAtiva, espessuraItem],
    queryFn: async () => {
      const lista = await base44.entities.ChapaCD.filter({ unidade: filialAtiva }, "-data_entrada", 300);
      return lista || [];
    },
    enabled: open,
  });

  // 2. Busca bobinas de C&D compatíveis da unidade
  const { data: bobinas = [], isLoading: loadingBobinas } = useQuery({
    queryKey: ["bobinas-selecao-pcp", filialAtiva, espessuraItem],
    queryFn: async () => {
      const lista = await base44.entities.Bobina.filter({
        setor: "corte_dobra",
        arquivada: false,
        unidade: filialAtiva
      }, "-data_entrada", 300);
      return lista || [];
    },
    enabled: open,
  });

  // Filtra chapas pela espessura do item e termo de busca
  const chapasFiltradas = chapas.filter(c => {
    const nEsp = getNumEsp(c);
    const isCompativel = numEspItem && nEsp ? Math.abs(nEsp - numEspItem) <= 0.04 : true;
    if (somenteCompativel && numEspItem && !isCompativel) return false;
    const termo = busca.toLowerCase();
    const matchBusca = !termo ||
      String(c.codigo || "").toLowerCase().includes(termo) ||
      String(c.descricao || "").toLowerCase().includes(termo) ||
      String(c.tipo_aco || "").toLowerCase().includes(termo) ||
      String(c.dimensoes || "").toLowerCase().includes(termo);
    return matchBusca;
  });

  // Filtra bobinas pela espessura do item e termo de busca
  const bobinasFiltradas = bobinas.filter(b => {
    const nEsp = getNumEsp(b);
    const isCompativel = numEspItem && nEsp ? Math.abs(nEsp - numEspItem) <= 0.04 : true;
    if (somenteCompativel && numEspItem && !isCompativel) return false;
    const termo = busca.toLowerCase();
    const matchBusca = !termo ||
      String(b.codigo || b.numero_bobina || "").toLowerCase().includes(termo) ||
      String(b.tipo || b.tipo_aco || "").toLowerCase().includes(termo) ||
      String(b.cor || "").toLowerCase().includes(termo);
    return matchBusca;
  });

  // Verificação de divergência do material selecionado
  const numEspSel = getNumEsp(selecionado);
  const isBitolaDivergente = Boolean(
    selecionado && numEspItem && numEspSel && Math.abs(numEspItem - numEspSel) > 0.04
  );

  const handleConfirmar = async () => {
    if (!selecionado || !pedido) return;
    setSalvando(true);
    try {
      const itens = getItens(pedido);
      const targetIdx = idx != null ? idx : 0;
      const itemAtual = itens[targetIdx] || item;

      const isChapa = selecionado.tipo === "chapa";
      const atualizacaoItem = {
        ...itemAtual,
        material_tipo: isChapa ? "chapa" : "bobina",
        material_id: selecionado.id,
        material_codigo: selecionado.codigo || selecionado.numero_bobina || "",
        material_descricao: selecionado.descricao || selecionado.tipo || selecionado.tipo_aco || "",
        material_dimensoes: selecionado.dimensoes || (selecionado.largura_mm ? `${selecionado.largura_mm}mm` : ""),
        material_reservado: true,
        chapa_cd_id: isChapa ? selecionado.id : undefined,
        bobina_id: !isChapa ? selecionado.id : undefined,
      };

      itens[targetIdx] = atualizacaoItem;

      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens)
      });

      // Se for chapa, podemos marcar a reserva na ChapaCD
      if (isChapa && selecionado.id) {
        try {
          await base44.entities.ChapaCD.update(selecionado.id, {
            reservado_pedido: pedido.numero_pedido || pedido.id,
            status: "reservado"
          });
        } catch (eChapa) {
          console.warn("[SelecionarMaterial] Falha ao atualizar status da chapa:", eChapa?.message || eChapa);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
      queryClient.invalidateQueries({ queryKey: ["chapas-cd-todas"] });
      queryClient.invalidateQueries({ queryKey: ["chapas-selecao-pcp"] });

      toast.success(`${isChapa ? "Chapa" : "Bobina"} vinculada e reservada para o pedido #${pedido.numero_pedido}!`);
      if (onMaterialVinculado) onMaterialVinculado(atualizacaoItem);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao vincular material: " + (err?.message || ""));
    } finally {
      setSalvando(false);
    }
  };

  const handleDesvincular = async () => {
    if (!pedido) return;
    setSalvando(true);
    try {
      const itens = getItens(pedido);
      const targetIdx = idx != null ? idx : 0;
      const itemAtual = itens[targetIdx] || item;

      const atualizacaoItem = {
        ...itemAtual,
        material_tipo: null,
        material_id: null,
        material_codigo: null,
        material_descricao: null,
        material_dimensoes: null,
        material_reservado: false,
        chapa_cd_id: null,
        bobina_id: null,
      };

      itens[targetIdx] = atualizacaoItem;

      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens)
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
      toast.info("Vínculo de material removido com sucesso.");
      if (onMaterialVinculado) onMaterialVinculado(atualizacaoItem);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao desvincular material: " + (err?.message || ""));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="border-b border-border/80 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Scissors className="w-5 h-5 text-orange-500" />
              Selecionar Matéria-Prima para o Pedido
            </DialogTitle>
            {item?.material_codigo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDesvincular}
                disabled={salvando}
                className="text-xs text-destructive hover:bg-destructive/10 h-7 gap-1"
              >
                <X className="w-3.5 h-3.5" /> Liberar Material Atual
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Pedido <strong>#{pedido?.numero_pedido}</strong> · Item: <strong>{item?.produto}</strong></span>
              {espessuraItem && (
                <Badge className="bg-amber-500 text-white font-extrabold text-[11px]">
                  Espessura Solicitada: {espessuraItem} mm
                </Badge>
              )}
            </div>
            {item?.descricao && (
              <div className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                Instrução do Vendedor: <strong>{item.descricao}</strong>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Busca e Abas */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, dimensões ou descrição..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            {numEspItem && (
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={somenteCompativel}
                  onChange={e => setSomenteCompativel(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span>Exibir apenas bitola exata ({numEspItem} mm)</span>
              </label>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              {somenteCompativel ? "Filtrando rigorosamente" : "Exibindo estoque completo"}
            </span>
          </div>

          <Tabs value={abaMaterial} onValueChange={setAbaMaterial}>
            <TabsList className="grid grid-cols-2 w-full h-9">
              <TabsTrigger value="chapas" className="text-xs font-semibold gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Chapas ({chapasFiltradas.length})
              </TabsTrigger>
              <TabsTrigger value="bobinas" className="text-xs font-semibold gap-1.5">
                <Circle className="w-3.5 h-3.5" /> Bobinas ({bobinasFiltradas.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Lista de Chapas ou Bobinas */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] border border-border/80 rounded-xl p-2 space-y-2">
          {abaMaterial === "chapas" ? (
            loadingChapas ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Carregando estoque de chapas...</div>
            ) : chapasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhuma chapa de {espessuraItem ? `${espessuraItem}mm` : "estoque"} encontrada na unidade {filialAtiva}.
              </div>
            ) : (
              chapasFiltradas.map(chapa => {
                const isSel = selecionado?.id === chapa.id;
                const dim = chapa.dimensoes || (chapa.largura_mm && chapa.comprimento_mm ? `${chapa.largura_mm}x${chapa.comprimento_mm}` : "—");

                return (
                  <div
                    key={chapa.id}
                    onClick={() => setSelecionado({ ...chapa, tipo: "chapa" })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSel
                        ? "bg-orange-500/10 border-orange-500/60 ring-1 ring-orange-500/40"
                        : "bg-card border-border/70 hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-foreground font-mono">
                          {chapa.codigo || "CHAPA"}
                        </span>
                        {(() => {
                          const nEsp = getNumEsp(chapa);
                          const comp = numEspItem && nEsp ? Math.abs(nEsp - numEspItem) <= 0.04 : true;
                          return (
                            <Badge className={`text-[10px] font-bold ${comp ? "bg-emerald-600 text-white" : "bg-red-600 text-white animate-pulse"}`}>
                              {comp ? "★ " : "⚠️ "}{chapa.espessura ? `${chapa.espessura}mm` : "—"}
                            </Badge>
                          );
                        })()}
                        <span className="text-xs font-semibold text-foreground truncate">
                          {chapa.descricao || chapa.tipo_aco || "Chapa de Aço"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                        <span>Dimensões: <strong className="text-foreground">{dim}</strong></span>
                        {chapa.quantidade != null && <span>Qtd: <strong>{chapa.quantidade} un</strong></span>}
                        {chapa.peso_kg && <span>Peso: <strong>{chapa.peso_kg} kg</strong></span>}
                      </div>
                    </div>
                    {isSel && (
                      <CheckCircle2 className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )
          ) : (
            loadingBobinas ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Carregando estoque de bobinas...</div>
            ) : bobinasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhuma bobina de {espessuraItem ? `${espessuraItem}mm` : "estoque"} encontrada na unidade {filialAtiva}.
              </div>
            ) : (
              bobinasFiltradas.map(bobina => {
                const isSel = selecionado?.id === bobina.id;

                return (
                  <div
                    key={bobina.id}
                    onClick={() => setSelecionado({ ...bobina, tipo: "bobina" })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSel
                        ? "bg-orange-500/10 border-orange-500/60 ring-1 ring-orange-500/40"
                        : "bg-card border-border/70 hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-foreground font-mono">
                          #{bobina.codigo || bobina.numero_bobina || "BOBINA"}
                        </span>
                        {(() => {
                          const nEsp = getNumEsp(bobina);
                          const comp = numEspItem && nEsp ? Math.abs(nEsp - numEspItem) <= 0.04 : true;
                          return (
                            <Badge className={`text-[10px] font-bold ${comp ? "bg-emerald-600 text-white" : "bg-red-600 text-white animate-pulse"}`}>
                              {comp ? "★ " : "⚠️ "}{bobina.espessura ? `${bobina.espessura}mm` : "—"}
                            </Badge>
                          );
                        })()}
                        <span className="text-xs font-semibold text-foreground truncate">
                          {bobina.tipo || bobina.tipo_aco || "Bobina Master"}
                        </span>
                        {bobina.cor && (
                          <Badge className="text-[10px] bg-muted text-foreground">
                            {bobina.cor}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                        <span>Largura: <strong>{bobina.largura_mm || "1200"} mm</strong></span>
                        <span>Peso Restante: <strong className="text-emerald-600 font-mono">{bobina.peso_atual_kg || bobina.peso_kg || 0} kg</strong></span>
                      </div>
                    </div>
                    {isSel && (
                      <CheckCircle2 className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Alerta de Bitola Divergente com Bloqueio */}
        {isBitolaDivergente && (
          <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 space-y-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm text-red-700 dark:text-red-200">
                  🚫 BLOQUEIO OPERACIONAL: Bitola Divergente!
                </p>
                <p className="mt-0.5">
                  A Instrução do Vendedor exige espessura <strong>{numEspItem} mm</strong>, mas o material selecionado é de <strong>{numEspSel} mm</strong>.
                </p>
              </div>
            </div>
            <div className="pt-1 border-t border-red-400/40 flex items-center justify-between gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-red-800 dark:text-red-200">
                <input
                  type="checkbox"
                  checked={autorizaSubstituicao}
                  onChange={e => setAutorizaSubstituicao(e.target.checked)}
                  className="rounded border-red-400 text-red-600 focus:ring-red-500"
                />
                <span>Estou ciente e autorizo expressamente a substituição da bitola</span>
              </label>
              {isAdmin && (
                <span className="text-[10px] bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100 px-1.5 py-0.5 rounded font-bold">
                  Liberação Gestor/Admin
                </span>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border/80 pt-3 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {selecionado ? (
              <span>
                Selecionado: <strong className="text-foreground">{selecionado.codigo || selecionado.numero_bobina}</strong>
                {numEspSel && <span className="ml-1 text-slate-500">({numEspSel}mm)</span>}
              </span>
            ) : (
              <span>Nenhum material selecionado</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={!selecionado || salvando || (isBitolaDivergente && !autorizaSubstituicao)}
              className={`font-bold gap-1 ${
                isBitolaDivergente && !autorizaSubstituicao
                  ? "bg-slate-400 text-white cursor-not-allowed opacity-60"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {salvando ? "Vinculando..." : "Vincular e Reservar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
