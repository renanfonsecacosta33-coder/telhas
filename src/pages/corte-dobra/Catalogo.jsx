import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BookOpen, Search, Zap, Ruler, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CATALOGO, CATEGORIAS_CATALOGO, calcDesenvolvido, ESPESSURAS_CHAPA } from "@/lib/catalogo-cd";

export default function CatalogoCD() {
  const [busca, setBusca] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("todas");
  const [expandedId, setExpandedId] = useState(null);
  const [pedidoRapido, setPedidoRapido] = useState(null); // produto selecionado
  const queryClient = useQueryClient();

  // Buscar desenvolvimentos aprovados (necessários para criar OP)
  const { data: desenvolvimentos = [] } = useQuery({
    queryKey: ["desenvolvimentos-cd"],
    queryFn: () => base44.entities.DesenvolvimentoCD.list("-created_date", 200),
  });

  const produtosFiltrados = useMemo(() => {
    return CATALOGO.filter(p => {
      const matchCat = categoriaSel === "todas" || p.categoria === categoriaSel;
      const matchBusca = !busca || 
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        p.dimensoes.toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [busca, categoriaSel]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orange-500" />
            Catálogo AJL — Corte e Dobra
          </h1>
          <p className="text-sm text-muted-foreground">{CATALOGO.length} produtos · Comprimento desenvolvido calculado automaticamente</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, código ou dimensão..." className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={categoriaSel} onValueChange={setCategoriaSel}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {CATEGORIAS_CATALOGO.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resultado */}
      <p className="text-xs text-muted-foreground">{produtosFiltrados.length} produto(s) encontrado(s)</p>

      <div className="space-y-2">
        {produtosFiltrados.map(produto => {
          const cat = CATEGORIAS_CATALOGO.find(c => c.id === produto.categoria);
          const isExpanded = expandedId === produto.id;

          return (
            <div key={produto.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{produto.nome}</span>
                    {cat && <Badge className={`border text-xs ${cat.cor}`}>{cat.label}</Badge>}
                    <span className="text-xs text-muted-foreground font-mono bg-muted rounded px-1.5 py-0.5">{produto.dimensoes}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-orange-600">
                      <Ruler className="w-3 h-3 inline mr-0.5" />
                      Larg. necessária: {produto.largura_necessaria_mm ? `${produto.largura_necessaria_mm}mm` : "Sob medida"}
                    </span>
                    {produto.maquina_corte && <span>✂ {produto.maquina_corte}</span>}
                    {produto.maquina_dobra && <span>⚙ {produto.maquina_dobra}</span>}
                    <span>{produto.espessuras_disponiveis?.join(", ")}mm</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" className="h-8 text-xs gap-1 bg-orange-500 hover:bg-orange-600"
                    onClick={() => setPedidoRapido(produto)}>
                    <Zap className="w-3.5 h-3.5" /> Pedido Rápido
                  </Button>
                  <button onClick={() => setExpandedId(isExpanded ? null : produto.id)}
                    className="p-2 text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Detalhe expandido */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/20 px-4 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                    {produto.espessuras_disponiveis?.map(esp => {
                      const desenv = calcDesenvolvido(produto.abas || [], produto.dobras || 0, esp);
                      return (
                        <div key={esp} className="bg-white border border-border rounded-lg px-3 py-2">
                          <p className="text-muted-foreground text-[10px] uppercase">Esp. {esp}mm</p>
                          <p className="font-bold text-orange-600">{desenv}mm</p>
                          <p className="text-muted-foreground text-[10px]">= {(desenv/1000).toFixed(3)}m desenvolvido</p>
                        </div>
                      );
                    })}
                  </div>
                  {produto.observacao && (
                    <p className="text-xs text-muted-foreground italic">{produto.observacao}</p>
                  )}
                  {produto.dobras > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {produto.dobras} dobra(s) de 90° · Abas: [{produto.abas?.join(", ")}]mm
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog Pedido Rápido */}
      {pedidoRapido && (
        <PedidoRapidoDialog
          produto={pedidoRapido}
          desenvolvimentos={desenvolvimentos}
          onClose={() => setPedidoRapido(null)}
          onSaved={() => {
            setPedidoRapido(null);
            queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
            toast.success("Ordem criada com sucesso!");
          }}
        />
      )}
    </div>
  );
}

function PedidoRapidoDialog({ produto, desenvolvimentos, onClose, onSaved }) {
  const [espessura, setEspessura] = useState("");
  const [materialSel, setMaterialSel] = useState(null); // objeto do estoque selecionado
  const [comprimento, setComprimento] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [cliente, setCliente] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [devId, setDevId] = useState("");
  const [saving, setSaving] = useState(false);

  // Buscar bobinas CD e chapas disponíveis em estoque
  const { data: bobinasCD = [] } = useQuery({
    queryKey: ["bobinas-cd-estoque"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
  });
  const { data: chapasCD = [] } = useQuery({
    queryKey: ["chapas-cd-disponiveis"],
    queryFn: () => base44.entities.ChapaCD.filter({ status: "disponivel" }),
  });

  // Materiais do estoque compatíveis com este produto
  // Compatibilidade: espessura do catálogo deve bater com a chapa/bobina
  const materiaisCompativeis = useMemo(() => {
    const result = [];
    // Bobinas com largura compatível
    bobinasCD.forEach(b => {
      const esp = parseFloat(b.chapa);
      if (!esp) return;
      if (produto.espessuras_disponiveis?.length && !produto.espessuras_disponiveis.some(e => Math.abs(e - esp) < 0.05)) return;
      if (produto.largura_necessaria_mm && b.largura_mm && b.largura_mm < produto.largura_necessaria_mm) return;
      result.push({
        id: `bobina_${b.id}`,
        label: `[Bobina] ${b.codigo || "—"} · ${b.chapa}mm · ${b.largura_mm || "?"}mm · ${b.cor || ""}`,
        espessura: esp,
        largura_mm: b.largura_mm,
        origem: "bobina",
        estoque_ref: b,
      });
    });
    // Chapas disponíveis
    chapasCD.forEach(c => {
      const desc = c.bobina_descricao || "";
      // tenta extrair espessura da descrição (padrão: "0,43" ou "0.43")
      const match = desc.match(/(\d+[.,]\d+)\s*mm/i) || desc.match(/ch[:\s]*(\d+[.,]\d+)/i);
      const esp = match ? parseFloat(match[1].replace(",", ".")) : null;
      if (esp && produto.espessuras_disponiveis?.length && !produto.espessuras_disponiveis.some(e => Math.abs(e - esp) < 0.05)) return;
      result.push({
        id: `chapa_${c.id}`,
        label: `[Chaparia] ${c.bobina_descricao || "—"} · ${c.comprimento_mm}mm · ${c.quantidade_disponivel}pç disp.`,
        espessura: esp,
        largura_mm: c.largura_mm,
        comprimento_mm: c.comprimento_mm,
        origem: "chapa",
        estoque_ref: c,
      });
    });
    return result;
  }, [bobinasCD, chapasCD, produto]);

  // Quando seleciona material, atualiza espessura automaticamente
  const handleSelecionarMaterial = (id) => {
    const mat = materiaisCompativeis.find(m => m.id === id);
    setMaterialSel(mat || null);
    if (mat?.espessura) setEspessura(String(mat.espessura));
  };

  const desenv = espessura ? calcDesenvolvido(produto.abas || [], produto.dobras || 0, parseFloat(espessura)) : null;

  const devsFiltrados = desenvolvimentos.filter(d =>
    d.status === "aprovado" || d.status === "em_producao"
  );

  const handleSave = async () => {
    if (!devId) {
      toast.error("Selecione um Desenvolvimento aprovado para criar a OP.");
      return;
    }
    if (!comprimento) {
      toast.error("Informe o comprimento das peças.");
      return;
    }
    const dev = desenvolvimentos.find(d => d.id === devId);
    setSaving(true);
    // Criar OP de corte
    await base44.entities.OrdemMaquinaCD.create({
      data,
      maquina: produto.maquina_corte || "CORTE 3M",
      tipo_peca: produto.nome,
      dimensoes_livres: `${produto.dimensoes} | esp. ${espessura}mm | comp. ${comprimento}mm | desenv. ${desenv}mm`,
      numero_pedido: numeroPedido,
      cliente,
      quantidade: parseInt(quantidade),
      status: "pendente",
    });
    // Se tem dobras, criar OP de dobra
    if (produto.maquina_dobra && produto.dobras > 0) {
      await base44.entities.OrdemMaquinaCD.create({
        data,
        maquina: produto.maquina_dobra,
        tipo_peca: produto.nome,
        dimensoes_livres: `${produto.dimensoes} | esp. ${espessura}mm | comp. ${comprimento}mm`,
        numero_pedido: numeroPedido,
        cliente,
        quantidade: parseInt(quantidade),
        status: "pendente",
      });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Pedido Rápido — {produto.codigo}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{produto.nome}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gate: Desenvolvimento obrigatório */}
          <div className={`rounded-xl p-3 border ${devsFiltrados.length === 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-start gap-2">
              {devsFiltrados.length === 0
                ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                : <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-xs font-bold ${devsFiltrados.length === 0 ? "text-red-700" : "text-amber-800"}`}>
                  {devsFiltrados.length === 0
                    ? "Nenhum Desenvolvimento aprovado encontrado!"
                    : "Selecione o Desenvolvimento técnico (obrigatório)"}
                </p>
                {devsFiltrados.length === 0 && (
                  <p className="text-xs text-red-600 mt-0.5">Crie e aprove um Desenvolvimento antes de emitir a OP.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Desenvolvimento Aprovado *</Label>
            <Select value={devId} onValueChange={setDevId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o desenvolvimento..." />
              </SelectTrigger>
              <SelectContent>
                {devsFiltrados.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome_peca} {d.numero_pedido ? `· #${d.numero_pedido}` : ""} ({d.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Material do estoque */}
          <div className="space-y-1">
            <Label>Material do Estoque *</Label>
            {materiaisCompativeis.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ Nenhuma bobina ou chapa compatível encontrada no estoque. Verifique o estoque de Bobinas CD e Chaparia.
              </div>
            ) : (
              <Select value={materialSel?.id || ""} onValueChange={handleSelecionarMaterial}>
                <SelectTrigger><SelectValue placeholder="Selecione do estoque..." /></SelectTrigger>
                <SelectContent>
                  {materiaisCompativeis.filter(m => m.origem === "bobina").length > 0 && (
                    <SelectItem value="_sep_bob" disabled className="text-xs font-bold text-muted-foreground uppercase">🪙 Bobinas</SelectItem>
                  )}
                  {materiaisCompativeis.filter(m => m.origem === "bobina").map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                  {materiaisCompativeis.filter(m => m.origem === "chapa").length > 0 && (
                    <SelectItem value="_sep_ch" disabled className="text-xs font-bold text-muted-foreground uppercase">📦 Chaparia</SelectItem>
                  )}
                  {materiaisCompativeis.filter(m => m.origem === "chapa").map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {materialSel && (
              <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3">
                {materialSel.espessura && <span>Esp: <strong>{materialSel.espessura}mm</strong></span>}
                {materialSel.largura_mm && <span>Largura: <strong>{materialSel.largura_mm}mm</strong></span>}
                {materialSel.comprimento_mm && <span>Comp. chapa: <strong>{materialSel.comprimento_mm}mm</strong></span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Espessura (mm)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 1.25"
                value={espessura}
                onChange={e => setEspessura(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Preenchida automaticamente ao selecionar material</p>
            </div>
            <div className="space-y-1">
              <Label>Comprimento das peças (mm)</Label>
              <Input type="number" placeholder="Ex: 3000" value={comprimento} onChange={e => setComprimento(e.target.value)} />
            </div>
          </div>

          {desenv && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs">
              <span className="text-orange-700 font-bold">Comprimento desenvolvido (planificação): {desenv}mm</span>
              <span className="text-orange-600 ml-2">= {(desenv/1000).toFixed(3)}m de chapa</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nº Pedido</Label>
              <Input placeholder="12345" value={numeroPedido} onChange={e => setNumeroPedido(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Cliente</Label>
            <Input placeholder="Nome do cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
          </div>

          {produto.maquina_dobra && produto.dobras > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              ✓ Serão criadas <strong>2 ordens</strong>: OP de corte ({produto.maquina_corte}) + OP de dobra ({produto.maquina_dobra})
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !devId} className="bg-orange-500 hover:bg-orange-600">
            {saving ? "Criando..." : "Criar Ordem(ns)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}