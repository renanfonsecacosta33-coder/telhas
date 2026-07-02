import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, ArrowLeftRight, Truck, PackageCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";

const STATUS_CONFIG = {
  pendente:    { label: "Pendente",    color: "bg-yellow-100 text-yellow-800 border-yellow-200",   icon: Clock },
  aprovada:    { label: "Aprovada",    color: "bg-blue-100 text-blue-800 border-blue-200",         icon: CheckCircle2 },
  recusada:    { label: "Recusada",    color: "bg-red-100 text-red-800 border-red-200",            icon: XCircle },
  em_transito: { label: "Em Trânsito", color: "bg-purple-100 text-purple-800 border-purple-200",   icon: Truck },
  concluida:   { label: "Concluída",   color: "bg-green-100 text-green-800 border-green-200",      icon: PackageCheck },
};

function AvaliarTransferenciaDialog({ transferencia, onClose }) {
  const qc = useQueryClient();
  const [resposta, setResposta] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [saving, setSaving] = useState(false);

  const avaliar = async (decisao) => {
    setSaving(true);
    try {
      const newStatus = decisao === "aprovada" ? "aprovada" : "recusada";
      await base44.entities.Transferencia.update(transferencia.id, {
        status: newStatus,
        resposta_admin: resposta,
        admin_nome: adminNome,
        data_avaliacao: new Date().toISOString().split("T")[0],
      });

      qc.invalidateQueries({ queryKey: ["transferencias"] });
      toast.success(decisao === "aprovada" ? "Transferência aprovada! Aguardar envio." : "Transferência recusada.");
      onClose();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Erro ao avaliar transferência";
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  const concluirTransito = async () => {
    setSaving(true);
    try {
      await base44.entities.Transferencia.update(transferencia.id, {
        status: "em_transito",
        resposta_admin: resposta,
        admin_nome: adminNome,
      });
      qc.invalidateQueries({ queryKey: ["transferencias"] });
      toast.success("Transferência marcada como em trânsito!");
      onClose();
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar Transferência</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-semibold">{transferencia.item_descricao}</p>
            <p className="text-muted-foreground">De: <span className="font-medium text-foreground">{transferencia.unidade_origem}</span> → Para: <span className="font-medium text-foreground">{transferencia.unidade_destino}</span></p>
            <p className="text-muted-foreground">Solicitante: <span className="font-medium text-foreground">{transferencia.solicitante_nome}</span></p>
            {transferencia.cliente && <p className="text-muted-foreground">Cliente: {transferencia.cliente}</p>}
            {transferencia.numero_pedido && <p className="text-muted-foreground">Pedido: {transferencia.numero_pedido}</p>}
            <p className="text-muted-foreground">Tipo: {transferencia.transferencia_tipo === "parcial" ? `Parcial — ${transferencia.peso_kg} kg` : "Inteira"}</p>
            {transferencia.motivo && <p className="text-muted-foreground">Obs: {transferencia.motivo}</p>}
          </div>

          <div className="space-y-1">
            <Label>Seu nome (admin) *</Label>
            <Input placeholder="Nome de quem está avaliando" value={adminNome} onChange={e => setAdminNome(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Mensagem para o solicitante</Label>
            <Textarea placeholder="Justificativa ou observação (opcional)" value={resposta} onChange={e => setResposta(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => avaliar("recusada")} disabled={saving || !adminNome}>
            <XCircle className="w-4 h-4 mr-1" /> Recusar
          </Button>
          <Button onClick={() => avaliar("aprovada")} disabled={saving || !adminNome} className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConcluirTransferenciaDialog({ transferencia, onClose }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const concluir = async () => {
    setSaving(true);
    try {
      // Ao concluir, atualiza o item: muda a unidade para a de destino
      const entityName = transferencia.item_tipo === "chapa" ? "ChapaCD" : transferencia.item_tipo === "slitter" ? "Slitter" : "Bobina";
      await base44.entities[entityName].update(transferencia.item_id, {
        unidade: transferencia.unidade_destino,
      });

      await base44.entities.Transferencia.update(transferencia.id, {
        status: "concluida",
      });

      qc.invalidateQueries({ queryKey: ["transferencias"] });
      qc.invalidateQueries({ queryKey: ["bobinas"] });
      qc.invalidateQueries({ queryKey: ["bobinas-cd"] });
      qc.invalidateQueries({ queryKey: ["chapas-vendedor"] });
      qc.invalidateQueries({ queryKey: ["slitters-vendedor"] });
      toast.success("Transferência concluída! Item movido para a filial de destino.");
      onClose();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Erro ao concluir transferência";
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-green-600" />
            Concluir Transferência
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <p className="font-semibold">{transferencia.item_descricao}</p>
          <p className="text-muted-foreground">De: <strong>{transferencia.unidade_origem}</strong> → Para: <strong>{transferencia.unidade_destino}</strong></p>
          {transferencia.transferencia_tipo === "parcial" && <p className="text-muted-foreground">Quantidade: {transferencia.peso_kg} kg</p>}
        </div>

        <p className="text-sm text-muted-foreground">
          Ao concluir, o item será oficialmente movido para o estoque da filial <strong>{transferencia.unidade_destino}</strong>. Confirma que o item chegou?
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={concluir} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? "Concluindo..." : "Confirmar Chegada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PainelTransferencias({ setor }) {
  const [avaliar, setAvaliar] = useState(null);
  const [concluir, setConcluir] = useState(null);
  const { filialAtiva } = useFilial();

  // Transferências recebidas (destino = filial ativa)
  const { data: recebidas = [], isLoading } = useQuery({
    queryKey: ["transferencias-recebidas", setor, filialAtiva],
    queryFn: () => base44.entities.Transferencia.filter({ setor, unidade_destino: filialAtiva }),
    refetchInterval: 30000,
  });

  // Transferências enviadas (origem = filial ativa)
  const { data: enviadas = [] } = useQuery({
    queryKey: ["transferencias-enviadas", setor, filialAtiva],
    queryFn: () => base44.entities.Transferencia.filter({ setor, unidade_origem: filialAtiva }),
    refetchInterval: 30000,
  });

  const pendentesRecebidas = recebidas.filter(t => t.status === "pendente");
  const aprovadasRecebidas = recebidas.filter(t => t.status === "aprovada" || t.status === "em_transito");
  const historicoRecebidas = recebidas.filter(t => t.status === "concluida" || t.status === "recusada").sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const enviadasPendentes = enviadas.filter(t => t.status === "pendente" || t.status === "aprovada" || t.status === "em_transito");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold">Transferências entre Filiais</h2>
        {pendentesRecebidas.length > 0 && (
          <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendentesRecebidas.length} recebida{pendentesRecebidas.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Recebidas - Pendentes */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-muted border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : pendentesRecebidas.length === 0 && aprovadasRecebidas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          Nenhuma transferência pendente para <strong>{filialAtiva}</strong>.
        </div>
      ) : (
        <div className="space-y-2">
          {pendentesRecebidas.map(t => {
            const cfg = STATUS_CONFIG[t.status];
            const Icon = cfg.icon;
            return (
              <div key={t.id} className="bg-card border border-yellow-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                    <span className="text-xs text-blue-600 font-medium">De: {t.unidade_origem}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.created_date ? format(new Date(t.created_date), "dd/MM HH:mm", { locale: ptBR }) : ""}
                    </span>
                  </div>
                  <p className="font-semibold text-sm truncate">{t.item_descricao}</p>
                  <p className="text-sm text-muted-foreground">
                    Solicitante: <span className="font-medium text-foreground">{t.solicitante_nome}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.transferencia_tipo === "parcial" ? `Parcial — ${t.peso_kg} kg` : "Inteira"}
                    {t.motivo ? ` — ${t.motivo}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => setAvaliar(t)}>Avaliar</Button>
              </div>
            );
          })}

          {aprovadasRecebidas.map(t => {
            const cfg = STATUS_CONFIG[t.status];
            const Icon = cfg.icon;
            return (
              <div key={t.id} className="bg-card border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                    <span className="text-xs text-blue-600 font-medium">De: {t.unidade_origem}</span>
                  </div>
                  <p className="font-semibold text-sm truncate">{t.item_descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.transferencia_tipo === "parcial" ? `Parcial — ${t.peso_kg} kg` : "Inteira"}
                    {t.admin_nome ? ` • Aprovado por: ${t.admin_nome}` : ""}
                  </p>
                </div>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setConcluir(t)}>
                  <PackageCheck className="w-3.5 h-3.5 mr-1" /> Confirmar Chegada
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Histórico recebidas */}
      {historicoRecebidas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico de recebidas</p>
          <div className="space-y-2">
            {historicoRecebidas.map(t => {
              const cfg = STATUS_CONFIG[t.status];
              const Icon = cfg.icon;
              return (
                <div key={t.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} shrink-0`}>
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.item_descricao}</p>
                    <p className="text-xs text-muted-foreground">{t.unidade_origem} → {t.unidade_destino}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t.data_avaliacao ? format(new Date(t.data_avaliacao), "dd/MM", { locale: ptBR }) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enviadas */}
      {enviadasPendentes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Enviadas por {filialAtiva}</p>
          <div className="space-y-2">
            {enviadasPendentes.map(t => {
              const cfg = STATUS_CONFIG[t.status];
              const Icon = cfg.icon;
              return (
                <div key={t.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} shrink-0`}>
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.item_descricao}</p>
                    <p className="text-xs text-muted-foreground">Para: {t.unidade_destino}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {avaliar && <AvaliarTransferenciaDialog transferencia={avaliar} onClose={() => setAvaliar(null)} />}
      {concluir && <ConcluirTransferenciaDialog transferencia={concluir} onClose={() => setConcluir(null)} />}
    </div>
  );
}