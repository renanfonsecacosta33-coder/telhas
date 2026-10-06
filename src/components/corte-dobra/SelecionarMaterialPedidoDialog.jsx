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

  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  const espessuraItem = item?.espessura ? String(item.espessura).replace(",", ".").trim() : "";

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
    const espChapa = String(c.espessura || "").replace(",", ".").trim();
    const matchEsp = !espessuraItem || espChapa.includes(espessuraItem) || espessuraItem.includes(espChapa);
    const termo = busca.toLowerCase();
    const matchBusca = !termo ||
      String(c.codigo || "").toLowerCase().includes(termo) ||
      String(c.descricao || "").toLowerCase().includes(termo) ||
      String(c.tipo_aco || "").toLowerCase().includes(termo) ||
      String(c.dimensoes || "").toLowerCase().includes(termo);
    return matchEsp && matchBusca;
  });

  // Filtra bobinas pela espessura do item e termo de busca
  const bobinasFiltradas = bobinas.filter(b => {
    const espBobina = String(b.espessura || "").replace(",", ".").trim();
    const matchEsp = !espessuraItem || espBobina.includes(espessuraItem) || espessuraItem.includes(espBobina);
    const termo = busca.toLowerCase();
    const matchBusca = !termo ||
      String(b.codigo || b.numero_bobina || "").toLowerCase().includes(termo) ||
      String(b.tipo || b.tipo_aco || "").toLowerCase().includes(termo) ||
      String(b.cor || "").toLowerCase().includes(termo);
    return matchEsp && matchBusca;
  });

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
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Pedido <strong>#{pedido?.numero_pedido}</strong> · Item: <strong>{item?.produto}</strong>
            {espessuraItem && (
              <Badge variant="outline" className="ml-2 bg-background font-bold text-[11px] text-foreground">
                Espessura: {espessuraItem}mm
              </Badge>
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
                        <Badge variant="outline" className="text-[10px] bg-background">
                          {chapa.espessura ? `${chapa.espessura}mm` : "—"}
                        </Badge>
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
                        <Badge variant="outline" className="text-[10px] bg-background">
                          {bobina.espessura ? `${bobina.espessura}mm` : "—"}
                        </Badge>
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

        <DialogFooter className="border-t border-border/80 pt-3 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {selecionado ? (
              <span>Selecionado: <strong className="text-foreground">{selecionado.codigo || selecionado.numero_bobina}</strong></span>
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
              disabled={!selecionado || salvando}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-1"
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
