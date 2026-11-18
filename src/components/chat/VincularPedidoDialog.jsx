import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Package, Check, Loader2, Tag } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VincularPedidoDialog({
  open,
  onOpenChange,
  canal_tipo,
  canal_id,
  onSelectPedido
}) {
  const [busca, setBusca] = useState("");
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) return;
    let ativo = true;

    const carregar = async () => {
      setCarregando(true);
      try {
        let lista = [];
        // Se for canal de máquina, busca as OPs desta máquina primeiro
        if (canal_tipo === "maquina" && canal_id) {
          lista = await base44.entities.Pedido.filter(
            { maquina: canal_id, status: { $ne: "cancelado" } },
            "-data",
            40
          ).catch(() => []);
        }

        // Se veio vazia ou canal geral, busca pedidos gerais recentes
        if (!lista || lista.length === 0) {
          lista = await base44.entities.Pedido.list("-data", 50).catch(() => []);
        }

        if (ativo) {
          setPedidos(lista || []);
        }
      } catch (err) {
        console.error("Erro ao carregar pedidos para vínculo:", err);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();
    return () => { ativo = false; };
  }, [open, canal_tipo, canal_id]);

  const pedidosFiltrados = useMemo(() => {
    if (!busca.trim()) return pedidos;
    const termo = busca.toLowerCase().trim();
    return pedidos.filter(p => {
      const num = String(p.numero_pedido || "").toLowerCase();
      const cli = String(p.cliente || "").toLowerCase();
      const prod = String(p.produto || "").toLowerCase();
      return num.includes(termo) || cli.includes(termo) || prod.includes(termo);
    });
  }, [pedidos, busca]);

  const handleEscolher = (p) => {
    const num = p.numero_pedido ? (p.numero_pedido.startsWith("#") ? p.numero_pedido : `#${p.numero_pedido}`) : `#${String(p.id).slice(-4)}`;
    const resumo = `${p.produto || "Telha"} · ${p.cliente || "Cliente"}`;
    onSelectPedido({
      id: p.id,
      numero_pedido: num,
      produto: p.produto || "",
      cliente: p.cliente || "",
      resumo
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg font-sans p-5 sm:p-6 rounded-2xl shadow-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
            <Tag className="w-5 h-5 text-primary" />
            Vincular Pedido / OP à Mensagem
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione uma ordem de produção para fixar um atalho direto na sua mensagem.
          </DialogDescription>
        </DialogHeader>

        {/* Campo de Busca Rápida */}
        <div className="relative my-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            autoFocus
            type="text"
            placeholder="Buscar por número (#S05...) ou nome do cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-11 text-sm font-semibold rounded-xl border-2 focus-visible:ring-primary shadow-xs"
          />
        </div>

        {/* Lista de Pedidos */}
        <div className="flex-1 overflow-y-auto space-y-2 py-1 min-h-[220px] max-h-[360px] pr-1">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-semibold">Carregando ordens ativas...</span>
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Nenhuma ordem encontrada para o termo digitado.
            </div>
          ) : (
            pedidosFiltrados.map((p) => {
              const num = p.numero_pedido ? (p.numero_pedido.startsWith("#") ? p.numero_pedido : `#${p.numero_pedido}`) : `#${String(p.id).slice(-4)}`;
              return (
                <div
                  key={p.id}
                  onClick={() => handleEscolher(p)}
                  className="p-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-primary group-hover:underline">
                        {num}
                      </span>
                      {p.maquina && (
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {p.maquina}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {p.status || "pendente"}
                      </Badge>
                    </div>
                    <p className="text-xs font-bold text-foreground truncate mt-1">
                      {p.cliente || "Cliente não informado"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.produto || "Material"} {p.metros ? `• ${Number(p.metros).toFixed(1)}m` : ""}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-8 px-2.5 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                  >
                    Vincular <Check className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
