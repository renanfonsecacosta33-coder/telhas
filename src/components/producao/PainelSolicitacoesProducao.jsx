import React, { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, BellRing, Route, Star } from "lucide-react";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";
import { playUrgentSound, speakSolicitacaoPendente } from "@/lib/sounds";

export default function PainelSolicitacoesProducao({ maquina, user }) {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["solicitacoes-producao", maquina, filialAtiva],
    queryFn: () => base44.entities.SolicitacaoProducao.filter({
      maquina, unidade: filialAtiva, status: "pendente"
    }, "-created_date", 20),
    refetchInterval: 8000,
  });

  const avaliarMutation = useMutation({
    mutationFn: async ({ id, aprovado, resposta }) => {
      return base44.entities.SolicitacaoProducao.update(id, {
        status: aprovado ? "aprovada" : "recusada",
        resposta_admin: resposta || "",
        admin_nome: user?.full_name || user?.email || "—",
        data_avaliacao: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-producao"] });
      toast.success("Solicitação avaliada!");
    },
  });

  // Toca som de alerta quando há novas solicitações pendentes
  const prevCount = useRef(0);
  useEffect(() => {
    if (solicitacoes.length > prevCount.current && prevCount.current >= 0) {
      playUrgentSound();
      speakSolicitacaoPendente(maquina);
    }
    prevCount.current = solicitacoes.length;
  }, [solicitacoes.length, maquina]);

  if (solicitacoes.length === 0) return null;

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-red-600 animate-pulse" />
        <h3 className="font-bold text-red-800 text-sm">
          {solicitacoes.length} solicitação{ solicitacoes.length > 1 ? "ões" : ""} de produção pendente{ solicitacoes.length > 1 ? "s" : ""}
        </h3>
      </div>
      <div className="space-y-2">
        {solicitacoes.map((s) => (
          <div key={s.id} className="bg-white border border-red-200 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800">{s.pedido_info}</span>
                  {s.tipo === "fora_prioridade" ? (
                    <Badge variant="destructive" className="text-xs">Fora de Rota/Prioridade</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Início Concomitante</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Operador: <strong>{s.operador_nome}</strong>
                </p>
                {s.pedido_rodando_info && (
                  <p className="text-xs text-amber-700">
                    OP rodando: {s.pedido_rodando_info}
                  </p>
                )}
                {s.motivo && (
                  <div className="bg-red-50 border border-red-200 rounded px-2 py-1.5 text-xs text-red-800">
                    <span className="font-semibold">Motivo: </span>{s.motivo}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-red-300 text-red-600 hover:bg-red-50 h-7"
                onClick={() => avaliarMutation.mutate({ id: s.id, aprovado: false, resposta: "Recusado pelo encarregado" })}
              >
                <X className="w-3 h-3" /> Recusar
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-green-600 hover:bg-green-700 h-7"
                onClick={() => avaliarMutation.mutate({ id: s.id, aprovado: true, resposta: "Aprovado pelo encarregado" })}
              >
                <Check className="w-3 h-3" /> Aprovar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}