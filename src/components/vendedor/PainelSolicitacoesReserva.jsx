import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, BookmarkPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pendente:  { label: "Pendente",  color: "bg-yellow-100 text-yellow-800 border-yellow-200",  icon: Clock },
  aprovada:  { label: "Aprovada",  color: "bg-green-100 text-green-800 border-green-200",     icon: CheckCircle2 },
  recusada:  { label: "Recusada",  color: "bg-red-100 text-red-800 border-red-200",           icon: XCircle },
};

function AvaliarDialog({ solicitacao, onClose }) {
  const qc = useQueryClient();
  const [resposta, setResposta] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [saving, setSaving] = useState(false);

  const avaliar = async (decisao) => {
    setSaving(true);
    try {
      await base44.entities.SolicitacaoReserva.update(solicitacao.id, {
        status: decisao,
        resposta_admin: resposta,
        admin_nome: adminNome,
        data_avaliacao: new Date().toISOString().split("T")[0],
      });

      // Se aprovada, efetiva a reserva no item correspondente
      if (decisao === "aprovada") {
        const entityName = solicitacao.item_tipo === "chapa" ? "ChapaCD" : solicitacao.item_tipo === "slitter" ? "Slitter" : "Bobina";
        await base44.entities[entityName].update(solicitacao.bobina_id, {
          reservada: true,
          reserva_tipo: solicitacao.reserva_tipo,
          reserva_kg: solicitacao.reserva_kg || undefined,
          reserva_numero_pedido: solicitacao.numero_pedido,
          reserva_motivo: solicitacao.motivo,
          reserva_autorizado_por: adminNome,
          reserva_data: new Date().toISOString().split("T")[0],
        });
      }

      qc.invalidateQueries({ queryKey: ["solicitacoes-reserva"] });
      qc.invalidateQueries({ queryKey: ["bobinas"] });
      qc.invalidateQueries({ queryKey: ["chapas-vendedor"] });
      qc.invalidateQueries({ queryKey: ["slitters-vendedor"] });
      toast.success(decisao === "aprovada" ? "Solicitação aprovada e reserva efetivada!" : "Solicitação recusada.");
      onClose();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Erro ao avaliar solicitação";
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar Solicitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-semibold">{solicitacao.bobina_descricao}</p>
            <p className="text-muted-foreground">Vendedor: <span className="font-medium text-foreground">{solicitacao.vendedor_nome}</span></p>
            {solicitacao.cliente && <p className="text-muted-foreground">Cliente: {solicitacao.cliente}</p>}
            {solicitacao.numero_pedido && <p className="text-muted-foreground">Pedido: {solicitacao.numero_pedido}</p>}
            <p className="text-muted-foreground">Tipo: {solicitacao.reserva_tipo === "parcial" ? `Parcial — ${solicitacao.reserva_kg} kg` : "Bobina inteira"}</p>
            {solicitacao.motivo && <p className="text-muted-foreground">Obs: {solicitacao.motivo}</p>}
          </div>

          <div className="space-y-1">
            <Label>Seu nome (admin) *</Label>
            <Input placeholder="Nome de quem está avaliando" value={adminNome} onChange={e => setAdminNome(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Mensagem para o vendedor</Label>
            <Textarea placeholder="Justificativa ou observação (opcional)" value={resposta} onChange={e => setResposta(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => avaliar("recusada")}
            disabled={saving || !adminNome}
          >
            <XCircle className="w-4 h-4 mr-1" /> Recusar
          </Button>
          <Button
            onClick={() => avaliar("aprovada")}
            disabled={saving || !adminNome}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PainelSolicitacoesReserva({ setor }) {
  const [avaliar, setAvaliar] = useState(null);

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["solicitacoes-reserva", setor],
    queryFn: () => base44.entities.SolicitacaoReserva.filter({ setor }),
    refetchInterval: 30000,
  });

  const pendentes = solicitacoes.filter(s => s.status === "pendente");
  const historico = solicitacoes.filter(s => s.status !== "pendente").sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookmarkPlus className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Solicitações de Reserva</h2>
        {pendentes.length > 0 && (
          <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Pendentes */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : pendentes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          Nenhuma solicitação pendente.
        </div>
      ) : (
        <div className="space-y-2">
          {pendentes.map(s => {
            const cfg = STATUS_CONFIG[s.status];
            const Icon = cfg.icon;
            return (
              <div key={s.id} className="bg-card border border-yellow-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.created_date ? format(new Date(s.created_date), "dd/MM HH:mm", { locale: ptBR }) : ""}
                    </span>
                  </div>
                  <p className="font-semibold text-sm truncate">{s.bobina_descricao}</p>
                  <p className="text-sm text-muted-foreground">
                    Vendedor: <span className="font-medium text-foreground">{s.vendedor_nome}</span>
                    {s.cliente ? ` • Cliente: ${s.cliente}` : ""}
                    {s.numero_pedido ? ` • Pedido: ${s.numero_pedido}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.reserva_tipo === "parcial" ? `Parcial — ${s.reserva_kg} kg` : "Bobina inteira"}
                    {s.motivo ? ` — ${s.motivo}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => setAvaliar(s)}>Avaliar</Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico recente</p>
          <div className="space-y-2">
            {historico.map(s => {
              const cfg = STATUS_CONFIG[s.status];
              const Icon = cfg.icon;
              return (
                <div key={s.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} shrink-0`}>
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.bobina_descricao}</p>
                    <p className="text-xs text-muted-foreground">{s.vendedor_nome}{s.admin_nome ? ` • Avaliado por: ${s.admin_nome}` : ""}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {s.data_avaliacao ? format(new Date(s.data_avaliacao), "dd/MM", { locale: ptBR }) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {avaliar && <AvaliarDialog solicitacao={avaliar} onClose={() => setAvaliar(null)} />}
    </div>
  );
}