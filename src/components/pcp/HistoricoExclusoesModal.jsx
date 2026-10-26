import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Trash2,
  Search,
  X,
  AlertTriangle,
  User,
  Calendar,
  Layers,
  FileText,
  RotateCcw
} from "lucide-react";
import { obterHistoricoExclusoes } from "@/lib/historicoExclusoesHelper";

export default function HistoricoExclusoesModal({ open, onOpenChange }) {
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    if (open) {
      setHistorico(obterHistoricoExclusoes());
    }
  }, [open]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return historico;
    const q = busca.toLowerCase().trim();
    return historico.filter((h) => {
      const ped = String(h.numero_pedido || "").toLowerCase();
      const cli = String(h.cliente_nome || "").toLowerCase();
      const ofNum = String(h.of_nome || h.of_odoo_id || "").toLowerCase();
      const mot = String(h.motivo || "").toLowerCase();
      const usr = String(h.usuario || "").toLowerCase();
      return (
        ped.includes(q) ||
        cli.includes(q) ||
        ofNum.includes(q) ||
        mot.includes(q) ||
        usr.includes(q)
      );
    });
  }, [historico, busca]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        className="w-[96vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl rounded-2xl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black text-white">
                  Histórico de Exclusões da Central PCP
                </DialogTitle>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] font-bold">
                  {historico.length} Registros
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Auditoria de pedidos excluídos da fila fabril com motivos e responsáveis.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900/30">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº de pedido, cliente, motivo ou responsável..."
              className="pl-9 h-9 bg-slate-950 border-slate-800 text-xs text-white placeholder:text-slate-500 focus-visible:ring-red-500"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {filtrados.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-25 text-red-400" />
              <p className="font-semibold text-sm">Nenhuma exclusão registrada com esse filtro.</p>
              <p className="text-xs text-slate-600 mt-1">
                Todas as ordens excluídas no PCP ficam salvas aqui para auditoria.
              </p>
            </div>
          ) : (
            filtrados.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-white">
                      Pedido #{item.numero_pedido}
                    </span>
                    {item.of_nome && (
                      <Badge variant="outline" className="border-indigo-400/40 text-indigo-300 text-[10px] font-mono">
                        OF: {item.of_nome}
                      </Badge>
                    )}
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] font-bold">
                      {item.estagio_no_cancelamento || "Cancelado"}
                    </Badge>
                    <span className="text-xs text-slate-300 font-medium">
                      {item.cliente_nome}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {new Date(item.data_exclusao).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Motivo da Exclusão em Destaque */}
                <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/30 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-red-300">Motivo da Exclusão: </span>
                    <span className="text-red-100">{item.motivo}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Excluído por: <strong className="text-slate-200">{item.usuario}</strong></span>
                  </div>
                  {item.itens_resumo && (
                    <div className="truncate max-w-sm text-slate-500">
                      Itens: {item.itens_resumo}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
