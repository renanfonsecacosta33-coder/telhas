import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle2, Truck, Camera, Disc, Clock, Calendar,
  FileText, MessageSquare, Share2, Check, AlertTriangle,
  Factory, Layers, User, Zap, ChevronRight, ShieldCheck,
  Building2, Hash, ArrowUpRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ChatPanel from "@/components/chat/ChatPanel";
import { useAuth } from "@/lib/AuthContext";
import SmartImage from "@/components/ui/SmartImage";
import { toast } from "sonner";
import { gerarMensagemWhatsApp } from "@/lib/vendedorHelper";

export default function PedidoDetalheDrawer({ card, open, onOpenChange }) {
  const { user } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("fotos");

  if (!card) return null;

  const canalId = String(card.numero_pedido || card.id);
  const canalLabel = `Pedido ${card.numero_pedido || card.id}`;

  const statusOp = card.statusOperacional || {
    label: "Aguardando PCP",
    sublabel: "Aguardando programação"
  };

  const fotos = card.fotos || { croquis: [], etiquetas: [], producao: [], colagem: [], carregamento: [], total: 0 };
  const bobinas = card.bobinasUtilizadas || [];
  const itens = card.itens || [];
  const historico = card.historico || [];

  const handleCopiarWhatsApp = () => {
    const texto = gerarMensagemWhatsApp(card);
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      toast.success(`Resumo do Pedido #${card.numero_pedido} copiado para WhatsApp!`);
      setTimeout(() => setCopiado(false), 2500);
    }).catch(() => {
      toast.error("Erro ao copiar para a área de transferência.");
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background">
        {/* Cabeçalho Fixo do Drawer */}
        <div className="p-5 border-b border-border bg-slate-50/60 dark:bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg text-foreground">
                  Pedido #{card.numero_pedido || "—"}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    card.setor === "Telhas"
                      ? "border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300"
                      : "border-orange-400 text-orange-700 bg-orange-50 dark:bg-orange-950 dark:text-orange-300"
                  }`}
                >
                  {card.setor}
                </Badge>
                {card.unidade && (
                  <Badge variant="secondary" className="text-xs">
                    <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                    {card.unidade}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-foreground mt-1 truncate" title={card.cliente}>
                {card.cliente || "Cliente não informado"}
              </h2>
              {card.vendedor && card.vendedor !== "—" && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  Vendedor Responsável: <strong className="text-foreground">{card.vendedor}</strong>
                </p>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleCopiarWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 font-semibold gap-1.5 shadow-sm"
              title="Copiar texto formatado para enviar no WhatsApp"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copiado ? "Copiado!" : "WhatsApp"}
            </Button>
          </div>

          {/* Card de Status Operacional em Tempo Real */}
          <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {statusOp.chave === "produzindo" ? <Zap className="w-4 h-4 animate-pulse text-blue-600" /> :
                   statusOp.chave === "colagem" ? <Layers className="w-4 h-4 text-purple-600" /> :
                   statusOp.chave === "pronto_patio" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                   statusOp.chave === "em_transito" ? <Truck className="w-4 h-4 text-indigo-600" /> :
                   <Clock className="w-4 h-4 text-amber-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-tight">
                    {statusOp.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {statusOp.sublabel}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-mono font-black text-primary">
                  {card.percentual}%
                </span>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Concluído</p>
              </div>
            </div>

            {/* Barra de Progresso Real */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  card.percentual >= 100
                    ? "bg-emerald-500"
                    : card.percentual > 50
                    ? "bg-blue-500"
                    : "bg-orange-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, card.percentual))}%` }}
              />
            </div>

            {/* Justificativa de alteração de prazo fabril se houver */}
            {card.motivo_alteracao_prazo && (
              <div className="mt-2.5 pt-2 border-t border-dashed border-amber-200 dark:border-amber-900 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <strong className="font-semibold">Ajuste de Previsão pelo PCP:</strong> {card.motivo_alteracao_prazo}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Abas Principais de Conteúdo */}
        <div className="p-5 flex-1 space-y-5">
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
            <TabsList className="grid grid-cols-5 w-full bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              <TabsTrigger value="fotos" className="text-xs font-semibold gap-1">
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fotos</span> ({fotos.total})
              </TabsTrigger>
              <TabsTrigger value="bobinas" className="text-xs font-semibold gap-1">
                <Disc className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bobinas</span> ({bobinas.length})
              </TabsTrigger>
              <TabsTrigger value="itens" className="text-xs font-semibold gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Itens</span> ({itens.length})
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs font-semibold gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs font-semibold gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: GALERIA DE FOTOS POR ETAPA */}
            <TabsContent value="fotos" className="mt-4 space-y-4">
              {fotos.total === 0 ? (
                <div className="text-center py-12 rounded-xl border border-dashed border-border p-6">
                  <Camera className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">Nenhuma foto registrada ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As fotos tiradas pelos operadores nas máquinas (etiqueta, produção e expedição) e croquis do Odoo aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Etapa: Croquis do Odoo */}
                  {fotos.croquis.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Desenhos Técnicos & Croquis do Odoo ({fotos.croquis.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {fotos.croquis.map((f, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-border shadow-2xs bg-muted">
                            <SmartImage
                              src={f.url}
                              alt={f.titulo}
                              className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                              clickable={true}
                            />
                            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                              <span className="text-[10px] font-bold text-white block truncate">
                                {f.titulo}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Etapa: Fotos de Produção na Máquina */}
                  {fotos.producao.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Factory className="w-4 h-4 text-blue-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Produção & Perfilação na Máquina ({fotos.producao.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {fotos.producao.map((f, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-border shadow-2xs bg-muted">
                            <SmartImage
                              src={f.url}
                              alt={f.titulo}
                              className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                              clickable={true}
                            />
                            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                              <span className="text-[10px] font-bold text-white block truncate">
                                {f.titulo}
                              </span>
                              <span className="text-[9px] text-slate-300 block">
                                {f.origem}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Etapa: Fotos de Colagem EPS */}
                  {fotos.colagem.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Colagem & Termoacústica EPS ({fotos.colagem.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {fotos.colagem.map((f, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-border shadow-2xs bg-muted">
                            <SmartImage
                              src={f.url}
                              alt={f.titulo}
                              className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                              clickable={true}
                            />
                            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                              <span className="text-[10px] font-bold text-white block truncate">
                                {f.titulo}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Etapa: Fotos de Etiqueta */}
                  {fotos.etiquetas.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Etiquetas de Identificação ({fotos.etiquetas.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {fotos.etiquetas.map((f, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-border shadow-2xs bg-muted">
                            <SmartImage
                              src={f.url}
                              alt={f.titulo}
                              className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                              clickable={true}
                            />
                            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                              <span className="text-[10px] font-bold text-white block truncate">
                                {f.titulo}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Etapa: Carregamento no Caminhão */}
                  {fotos.carregamento.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Expedição & Carregamento ({fotos.carregamento.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {fotos.carregamento.map((f, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-border shadow-2xs bg-muted">
                            <SmartImage
                              src={f.url}
                              alt={f.titulo}
                              className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                              clickable={true}
                            />
                            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                              <span className="text-[10px] font-bold text-white block truncate">
                                {f.titulo}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ABA 2: BOBINAS UTILIZADAS (100% SIGILO FINANCEIRO) */}
            <TabsContent value="bobinas" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Disc className="w-4 h-4 text-primary" />
                  Matéria-Prima Utilizada na Fabricação
                </h4>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-emerald-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" />
                  Rastreabilidade Garantida
                </Badge>
              </div>

              {bobinas.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-border p-5">
                  <Disc className="w-8 h-8 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-foreground">Nenhuma bobina vinculada ainda</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    O código da bobina aparecerá assim que a ordem for alocada ou o operador validar a matéria-prima na máquina.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bobinas.map((b, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Disc className="w-4 h-4 text-indigo-500" />
                          {b.codigo}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-bold ${
                            b.origem === "Nacional"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          Aço {b.origem || "Nacional"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Cor / Acabamento</span>
                          <strong className="text-foreground">{b.cor || "Padrão"}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Espessura (Chapa)</span>
                          <strong className="text-foreground">{b.espessura || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Qualidade</span>
                          <span className="font-semibold text-foreground">{b.qualidade || "GV"}</span>
                        </div>
                        {b.largura && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Largura</span>
                            <span className="font-semibold text-foreground">{b.largura}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA 3: ITENS DO PEDIDO */}
            <TabsContent value="itens" className="mt-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                Produtos do Pedido ({itens.length})
              </h4>

              {itens.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-border p-5">
                  <p className="text-xs text-muted-foreground">Itens detalhados não informados na ordem.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {itens.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-border bg-card flex items-start justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {it.quantidade || 1}x {it.produto || it.descricao || "Item"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {it.modelo ? `Modelo: ${it.modelo} · ` : ""}
                          {it.espessura ? `Chapa: ${it.espessura} · ` : ""}
                          {it.comprimento || it.medida ? `Medida: ${it.comprimento || it.medida}m` : ""}
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          it.concluido
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300"
                            : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {it.concluido ? "Concluído" : "Em fila"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA 4: HISTÓRICO / LINHA DO TEMPO */}
            <TabsContent value="historico" className="mt-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                Linha do Tempo de Produção
              </h4>

              {historico.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-border p-5">
                  <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {historico.map((ev, i) => (
                    <div key={i} className="relative group">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center bg-background" />
                      <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-xs font-bold text-foreground">{ev.titulo}</strong>
                          {ev.data && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {format(new Date(ev.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{ev.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA 5: CHAT COM A FÁBRICA / PCP */}
            <TabsContent value="chat" className="mt-4 space-y-3">
              <div className="rounded-xl border border-border overflow-hidden">
                <ChatPanel
                  canal_tipo="pedido"
                  canal_id={canalId}
                  canal_label={canalLabel}
                  currentUser={user}
                  heightClass="h-[400px]"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}