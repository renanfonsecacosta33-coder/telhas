import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Camera, 
  Maximize2, 
  X, 
  UserCheck, 
  Truck,
  FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ETAPAS_CARREGAMENTO } from "./RegistrarEtapaCarregamentoModal";
import RegistrarEtapaCarregamentoModal from "./RegistrarEtapaCarregamentoModal";

export default function TimelineCarregamentoViewer({
  rotaId,
  cargaId = null,
  placaVeiculo = "",
  motoristaNome = "",
  unidade = "Matriz AJL",
  user = null,
  permitirEdicao = true
}) {
  const [modalEtapaOpen, setModalEtapaOpen] = useState(false);
  const [etapaSelecionada, setEtapaSelecionada] = useState("1_veiculo_vazio");
  const [fotoLightbox, setFotoLightbox] = useState(null);

  // Buscar registros da timeline para esta rota
  const { data: registros = [], isLoading, refetch } = useQuery({
    queryKey: ["timeline-carregamento", rotaId, cargaId],
    queryFn: async () => {
      if (!rotaId && !cargaId) return [];
      try {
        const query = rotaId ? { rota_id: rotaId } : { carga_id: cargaId };
        const res = await base44.entities.TimelineCarregamento.filter(query, "-data_registro");
        return res || [];
      } catch (err) {
        console.error("Erro ao buscar timeline de carregamento:", err);
        return [];
      }
    },
    enabled: !!(rotaId || cargaId),
    refetchInterval: 10000 // auto-refresh a cada 10s no pátio
  });

  // Mapear último registro por etapa
  const registrosPorEtapa = ETAPAS_CARREGAMENTO.reduce((acc, etapa) => {
    const reg = registros.find(r => r.etapa === etapa.id);
    acc[etapa.id] = reg || null;
    return acc;
  }, {});

  // Contagem de concluídos
  const totalConcluidas = Object.values(registrosPorEtapa).filter(Boolean).length;
  const porcentagem = Math.round((totalConcluidas / ETAPAS_CARREGAMENTO.length) * 100);
  const todasConcluidas = totalConcluidas === ETAPAS_CARREGAMENTO.length;

  const handleAbrirRegistro = (etapaId) => {
    setEtapaSelecionada(etapaId);
    setModalEtapaOpen(true);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-6">
      {/* Cabeçalho com Status Geral e Progresso */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              Timeline Fotográfica de Carregamento & Amarração
            </h3>
            {todasConcluidas ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 py-0.5">
                <ShieldCheck className="h-3.5 w-3.5" /> 100% Liberado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/40 gap-1 px-2.5 py-0.5">
                <Clock className="h-3.5 w-3.5" /> Em Carregamento ({totalConcluidas}/5)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Registro sequencial obrigatório para auditoria visual de pátio e comprovação contra avarias no transporte.
          </p>
        </div>

        {/* Barra de Progresso visual */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                todasConcluidas ? "bg-emerald-500" : "bg-primary"
              }`}
              style={{ width: `${porcentagem}%` }}
            />
          </div>
          <span className="text-xs font-bold text-foreground min-w-[36px] text-right">
            {porcentagem}%
          </span>
        </div>
      </div>

      {/* Grid das 5 Etapas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {ETAPAS_CARREGAMENTO.map((etapa, idx) => {
          const reg = registrosPorEtapa[etapa.id];
          const isPendente = !reg;

          return (
            <div 
              key={etapa.id}
              className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                isPendente
                  ? "border-dashed border-border bg-muted/20 opacity-90 hover:opacity-100"
                  : reg.status_conformidade === "critico"
                  ? "border-red-500/40 bg-red-500/5 shadow-sm"
                  : reg.status_conformidade === "ressalva"
                  ? "border-amber-500/40 bg-amber-500/5 shadow-sm"
                  : "border-emerald-500/30 bg-emerald-500/5 shadow-sm"
              }`}
            >
              {/* Topo do Card: Número e Título */}
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isPendente 
                      ? "bg-muted text-muted-foreground" 
                      : "bg-primary/10 text-primary font-mono"
                  }`}>
                    Etapa {idx + 1}
                  </span>
                  
                  {reg ? (
                    reg.status_conformidade === "conforme" ? (
                      <Badge className="bg-emerald-600/90 text-white text-[10px] px-1.5 py-0 h-4">
                        Conforme
                      </Badge>
                    ) : reg.status_conformidade === "ressalva" ? (
                      <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4">
                        Ressalva
                      </Badge>
                    ) : (
                      <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0 h-4">
                        Crítico
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0 h-4 border-dashed">
                      Pendente
                    </Badge>
                  )}
                </div>

                <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                  {etapa.label}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  {etapa.desc}
                </p>
              </div>

              {/* Centro: Foto ou Placeholder */}
              <div className="my-3">
                {reg?.foto_url ? (
                  <div className="relative group rounded-lg overflow-hidden border border-border aspect-[4/3] bg-black/40">
                    <img 
                      src={reg.foto_url} 
                      alt={etapa.label}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setFotoLightbox(reg.foto_url)}
                        title="Ampliar Foto"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      {permitirEdicao && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-full bg-background/80"
                          onClick={() => handleAbrirRegistro(etapa.id)}
                          title="Substituir / Atualizar"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground/60 p-2 bg-muted/10">
                    <Camera className="h-6 w-6 mb-1 opacity-40" />
                    <span className="text-[10px] text-center font-medium">
                      Nenhuma foto enviada
                    </span>
                  </div>
                )}
              </div>

              {/* Rodapé: Detalhes ou Botão de Envio */}
              <div className="pt-2 border-t border-border/40 text-[11px]">
                {reg ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                      <span className="flex items-center gap-1 truncate max-w-[110px]" title={reg.operador_patio}>
                        <UserCheck className="h-3 w-3 text-primary/70 shrink-0" />
                        {reg.operador_patio?.split(" ")[0] || "Operador"}
                      </span>
                      <span>
                        {reg.data_registro ? new Date(reg.data_registro).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                      </span>
                    </div>
                    {reg.observacoes && (
                      <p className="text-[10px] text-muted-foreground italic truncate bg-muted/40 px-1.5 py-0.5 rounded border border-border/40" title={reg.observacoes}>
                        "{reg.observacoes}"
                      </p>
                    )}
                  </div>
                ) : (
                  permitirEdicao && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs h-8 gap-1.5 hover:border-primary hover:text-primary"
                      onClick={() => handleAbrirRegistro(etapa.id)}
                    >
                      <Camera className="h-3.5 w-3.5" /> Registrar Foto
                    </Button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal de Imagem em Alta Resolução */}
      {fotoLightbox && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setFotoLightbox(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-card rounded-2xl overflow-hidden shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-white bg-black/60 hover:bg-black/90 rounded-full z-10"
              onClick={() => setFotoLightbox(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img 
              src={fotoLightbox} 
              alt="Foto Carregamento Ampliada"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}

      {/* Modal de Registro de Etapa */}
      <RegistrarEtapaCarregamentoModal
        open={modalEtapaOpen}
        onOpenChange={setModalEtapaOpen}
        rotaId={rotaId}
        cargaId={cargaId}
        placaVeiculo={placaVeiculo}
        motoristaNome={motoristaNome}
        unidade={unidade}
        etapaSugerida={etapaSelecionada}
        user={user}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
