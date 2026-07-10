import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Layers, CheckCircle2, AlertTriangle, Link2, Play, DollarSign, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";

function normalizeEspessura(val) {
  if (!val) return "";
  return String(val).replace(/\s/g, "").replace(".", ",");
}

export default function OPSemMaterialTab() {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [vinculando, setVinculando] = useState(null); // { tipo: 'desb'|'maq', id, entidade }

  // OPs aguardando material — Desbobinadeira
  const { data: opsDesb = [], isLoading: loadingDesb } = useQuery({
    queryKey: ["ops-sem-material-desb", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({
      unidade: filialAtiva, status: "aguardando_material"
    }, "-data", 200),
    refetchInterval: 15000,
  });

  // OPs aguardando material — Máquinas CD
  const { data: opsMaq = [], isLoading: loadingMaq } = useQuery({
    queryKey: ["ops-sem-material-maq", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({
      unidade: filialAtiva, status: "aguardando_material"
    }, "-data", 200),
    refetchInterval: 15000,
  });

  // Bobinas em estoque CD
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-disponiveis", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({
      setor: "corte_dobra", arquivada: false, unidade: filialAtiva
    }),
    refetchInterval: 30000,
  });

  // Chapas disponíveis
  const { data: chapas = [] } = useQuery({
    queryKey: ["chapas-cd-disponiveis-sem-material", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }),
    refetchInterval: 30000,
  });

  // Verifica compatibilidade de material
  const checkDisponibilidade = (op, isDesb) => {
    const espessura = normalizeEspessura(op.material_espessura);
    const cor = (op.material_cor || "").trim().toLowerCase();

    if (isDesb) {
      // Para Desbobinadeira: procurar bobina com espessura e cor compatíveis
      return bobinas.filter(b => {
        const bEsp = normalizeEspessura(b.chapa) || normalizeEspessura(b.espessura_utilizada);
        const bEspAlt = (b.espessura_utilizada || "").split("/").map(s => normalizeEspessura(s));
        const espMatch = bEsp === espessura || bEspAlt.includes(espessura);
        const corMatch = !cor || (b.cor || "").trim().toLowerCase().includes(cor) || cor.includes((b.cor || "").trim().toLowerCase());
        return espMatch && corMatch && !b.arquivada;
      });
    } else {
      // Para Guilhotina/Dobradeira: procurar chapa com espessura compatível
      return chapas.filter(c => {
        const cEsp = normalizeEspessura(c.espessura_mm);
        const cEspBobina = normalizeEspessura((c.bobina_descricao || "").match(/[\d,]+mm/)?.[0]?.replace("mm", ""));
        const espMatch = cEsp === espessura || cEspBobina === espessura;
        const statusOk = c.status === "disponivel" || c.status === "parcial";
        return espMatch && statusOk;
      });
    }
  };

  // Liberar para produção
  const liberarMutation = useMutation({
    mutationFn: async ({ tipo, id, material_id, material_descricao, entidade }) => {
      const updates = {
        status: "pendente",
        material_em_falta: false,
      };
      if (tipo === "desb") {
        updates.bobina_id = material_id;
        updates.bobina_descricao = material_descricao;
        await base44.entities.OrdemDesbobinadeira.update(id, updates);
      } else {
        if (entidade === "chapa") {
          updates.chapa_cd_id = material_id;
          updates.chapa_descricao = material_descricao;
          updates.chapa_origem = "chaparia";
        } else {
          updates.bobina_id = material_id;
          updates.bobina_descricao = material_descricao;
          updates.chapa_origem = "direto";
        }
        await base44.entities.OrdemMaquinaCD.update(id, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-sem-material-desb"] });
      queryClient.invalidateQueries({ queryKey: ["ops-sem-material-maq"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      setVinculando(null);
      toast.success("OP liberada para produção!");
    },
    onError: (err) => toast.error("Erro ao liberar: " + err.message),
  });

  // Lista unificada
  const listaUnificada = useMemo(() => {
    const items = [
      ...opsDesb.map(o => ({ ...o, _tipo: "desb", _entidade: "bobina" })),
      ...opsMaq.map(o => ({ ...o, _tipo: "maq", _entidade: o.maquina?.includes("CORTE") || o.maquina?.includes("DOBRA") ? "chapa" : "bobina" })),
    ];
    if (!busca.trim()) return items;
    const q = busca.toLowerCase();
    return items.filter(o =>
      (o.numero_pedido || "").toLowerCase().includes(q) ||
      (o.cliente || "").toLowerCase().includes(q) ||
      (o.material_espessura || "").toLowerCase().includes(q) ||
      (o.material_cor || "").toLowerCase().includes(q)
    );
  }, [opsDesb, opsMaq, busca]);

  const isLoading = loadingDesb || loadingMaq;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (listaUnificada.length === 0 && !busca) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
        <Package className="w-12 h-12 text-muted-foreground/20" />
        <p className="font-semibold text-lg">Nenhuma OP aguardando material</p>
        <p className="text-sm text-muted-foreground">OPs marcadas como "Material em falta" aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            OP sem Material
          </h2>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">{listaUnificada.length} OP(s)</Badge>
        </div>
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por pedido, cliente, espessura..."
            className="h-9 pl-8 pr-8 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {listaUnificada.map(op => {
          const isDesb = op._tipo === "desb";
          const materiaisCompativeis = checkDisponibilidade(op, isDesb);
          const temMaterial = materiaisCompativeis.length > 0;
          const isVinculando = vinculando?.id === op.id;

          return (
            <div key={op.id} className={`bg-card border-2 rounded-xl p-4 ${temMaterial ? "border-green-400" : "border-amber-300"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Info da OP */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={isDesb ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-purple-100 text-purple-700 border-purple-200"}>
                      {isDesb ? "Desbobinadeira" : op.maquina}
                    </Badge>
                    {op.destino === "pedido_direto" && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">Pedido Direto</Badge>
                    )}
                    {op.destino === "estoque" && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">Estoque</Badge>
                    )}
                    {op.numero_pedido && <span className="text-sm font-mono text-muted-foreground">#{op.numero_pedido}</span>}
                    {op.cliente && <span className="text-sm text-muted-foreground">{op.cliente}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-muted-foreground">Espessura:</span>
                      <p className="font-bold">{op.material_espessura || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cor:</span>
                      <p className="font-bold">{op.material_cor || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Qtd:</span>
                      <p className="font-bold">{op.quantidade || 0} {isDesb ? "chapas" : "peças"}</p>
                    </div>
                    {op.comprimento_mm && (
                      <div>
                        <span className="text-muted-foreground">Corte:</span>
                        <p className="font-bold">{op.comprimento_mm}mm</p>
                      </div>
                    )}
                  </div>
                  {op.valor_pago_cliente > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-semibold">Valor pago: {op.valor_pago_cliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                  )}
                  {op.observacoes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">"{op.observacoes}"</p>
                  )}
                </div>

                {/* Indicador de disponibilidade */}
                <div className="flex flex-col items-end gap-2">
                  {temMaterial ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Disponível ({materiaisCompativeis.length})
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                      <AlertTriangle className="w-3 h-3" /> Sem estoque
                    </Badge>
                  )}

                  {temMaterial && !isVinculando && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => setVinculando({ tipo: op._tipo, id: op.id, entidade: op._entidade })}>
                      <Link2 className="w-3 h-3" /> Vincular e Liberar
                    </Button>
                  )}
                </div>
              </div>

              {/* Painel de vinculação */}
              {isVinculando && (
                <div className="mt-3 border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Selecionar material disponível:</p>
                  <Select onValueChange={matId => {
                    const mat = materiaisCompativeis.find(m => m.id === matId);
                    if (!mat) return;
                    const desc = isDesb
                      ? `[${mat.codigo || "—"}] ${mat.chapa || mat.espessura_utilizada || ""} — ${mat.cor || ""}`
                      : `[${mat.codigo || "—"}] ${mat.bobina_descricao || ""} — ${mat.comprimento_mm || ""}mm`;
                    liberarMutation.mutate({
                      tipo: op._tipo,
                      id: op.id,
                      material_id: matId,
                      material_descricao: desc,
                      entidade: op._entidade,
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder={`Selecione ${op._entidade === "chapa" ? "a chapa" : "a bobina"}...`} /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {materiaisCompativeis.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {isDesb ? (
                            <>
                              <span className="font-mono font-bold text-sm">{m.codigo || "—"}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{m.chapa || m.espessura_utilizada}mm</span>
                              {m.cor && <span className="text-blue-600 ml-1 text-xs">{m.cor}</span>}
                              <span className="text-muted-foreground ml-2 text-xs">{m.peso_kg}kg</span>
                            </>
                          ) : (
                            <>
                              <span className="font-mono font-bold text-sm">{m.codigo || "—"}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{m.bobina_descricao || "—"}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{m.comprimento_mm}mm</span>
                              <span className="text-green-600 ml-2 text-xs">{m.quantidade_disponivel}pç</span>
                            </>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setVinculando(null)}>Cancelar</Button>
                </div>
              )}

              {liberarMutation.isPending && vinculando?.id === op.id && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-muted border-t-orange-500 rounded-full animate-spin" />
                  Liberando...
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}