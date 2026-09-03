import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Factory,
  Scissors,
  Wind,
  Layers,
  Zap,
  CheckCircle2,
  Clock,
  Save,
  Send,
  Sparkles
} from "lucide-react";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { classGrupo } from "@/lib/pedidoOdooHelper";

const MAQUINAS_TELHA = [
  "TP - 25",
  "TP - 40",
  "ONDULADA",
  "COLONIAL",
  "BANDEJA",
  "CUMEEIRA",
  "COLAGEM",
  "DESBOBINADOR"
];

const MAQUINAS_CD = [
  "Dobradeira 3m",
  "Dobradeira 6m",
  "Guilhotina 3m",
  "Guilhotina 6m",
  "Perfiladeira",
  "Desbobinadeira",
  "Corte Plasma"
];

const MAQUINAS_FRISADA = [
  "Frisada",
  "Expedição"
];

function sugerirMaquinaPadrao(item) {
  if (item.maquina) return item.maquina;
  const prod = String(item.produto || item.descricao || "").toUpperCase();
  if (prod.includes("TP 25") || prod.includes("TP-25") || prod.includes("TP25")) return "TP - 25";
  if (prod.includes("TP 40") || prod.includes("TP-40") || prod.includes("TP40")) return "TP - 40";
  if (prod.includes("ONDULAD")) return "ONDULADA";
  if (prod.includes("COLONIAL")) return "COLONIAL";
  if (prod.includes("BANDEJA")) return "BANDEJA";
  if (prod.includes("CUMEEIRA")) return "CUMEEIRA";
  if (prod.includes("FRISADA")) return "Frisada";

  const grupo = classGrupo(item);
  if (grupo === "telha") return "TP - 25";
  if (grupo === "cd") return "Dobradeira 6m";
  if (grupo === "frisada") return "Frisada";
  return "TP - 25";
}

export default function ProgramadorItensSection({
  pedido,
  onProgramarItem,
  onProgramarTodosItens
}) {
  const [itensLocais, setItensLocais] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    const lista = parseItensPedido(pedido.itens_json);
    const hojeIso = new Date().toISOString().slice(0, 10);
    const dataPadrao = pedido.data_entrega || hojeIso;

    const inicializados = lista.map((it, idx) => ({
      ...it,
      _idx: idx,
      maquina: it.maquina || sugerirMaquinaPadrao(it),
      data_programada: it.data_programada || dataPadrao,
      status: it.status || (pedido.status_pcp === "distribuido" ? "distribuido" : "pendente"),
      distribuido: Boolean(it.distribuido || pedido.status_pcp === "distribuido")
    }));
    setItensLocais(inicializados);
  }, [pedido]);

  const atualizarItemLocal = (idx, campo, valor) => {
    setItensLocais(prev => {
      const cp = [...prev];
      cp[idx] = { ...cp[idx], [campo]: valor };
      return cp;
    });
  };

  const handleSalvarTudo = async (distribuir = true) => {
    setSalvando(true);
    try {
      const formatados = itensLocais.map(it => ({
        ...it,
        status: distribuir ? "distribuido" : it.status,
        distribuido: distribuir ? true : it.distribuido
      }));
      await onProgramarTodosItens(pedido, formatados, distribuir);
    } finally {
      setSalvando(false);
    }
  };

  const handleDistribuirItemIndividual = async (idx) => {
    const item = itensLocais[idx];
    if (!item) return;
    await onProgramarItem(pedido, idx, {
      maquina: item.maquina,
      data_programada: item.data_programada,
      distribuir: true
    });
    atualizarItemLocal(idx, "distribuido", true);
    atualizarItemLocal(idx, "status", "distribuido");
  };

  if (!itensLocais.length) return null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Programação &amp; Distribuição de Itens
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Defina a máquina e a data de produção de cada item individualmente ou distribua todos de uma vez.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => handleSalvarTudo(true)}
            disabled={salvando}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs h-7 gap-1 shadow-sm font-semibold"
          >
            <Send className="w-3 h-3" />
            {salvando ? "Distribuindo..." : "Distribuir Itens Programados"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {itensLocais.map((it, idx) => {
          const grupo = classGrupo(it);
          const maquinasOpcoes =
            grupo === "telha" ? MAQUINAS_TELHA :
            grupo === "cd" ? MAQUINAS_CD :
            grupo === "frisada" ? MAQUINAS_FRISADA :
            [...MAQUINAS_TELHA, ...MAQUINAS_CD];

          const isDistribuido = it.distribuido || it.status === "distribuido" || it.status === "concluido";

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDistribuido
                  ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 h-4 font-bold ${
                      grupo === "telha"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : grupo === "cd"
                        ? "bg-sky-100 text-sky-800 border-sky-300"
                        : "bg-teal-100 text-teal-800 border-teal-300"
                    }`}
                  >
                    {grupo === "telha" ? <Factory className="w-2.5 h-2.5 mr-0.5 inline" /> : <Scissors className="w-2.5 h-2.5 mr-0.5 inline" />}
                    {grupo.toUpperCase()}
                  </Badge>

                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {it.produto || it.descricao || `Item #${idx + 1}`}
                  </span>

                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    ({it.quantidade || 1} {it.unidade || "UN"})
                  </span>
                </div>

                {isDistribuido && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                    Distribuído para <strong>{it.maquina}</strong> na data <strong>{it.data_programada}</strong>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                <div className="w-36">
                  <Select
                    value={it.maquina}
                    onValueChange={(val) => atualizarItemLocal(idx, "maquina", val)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Selecione Máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      {maquinasOpcoes.map((m) => (
                        <SelectItem key={m} value={m} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32">
                  <Input
                    type="date"
                    value={it.data_programada || ""}
                    onChange={(e) => atualizarItemLocal(idx, "data_programada", e.target.value)}
                    className="h-7 text-xs px-2 py-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    title="Data Programada de Produção"
                  />
                </div>

                <Button
                  size="sm"
                  variant={isDistribuido ? "outline" : "default"}
                  onClick={() => handleDistribuirItemIndividual(idx)}
                  className={`h-7 px-2.5 text-xs gap-1 shrink-0 font-medium ${
                    isDistribuido
                      ? "text-blue-600 border-blue-300 hover:bg-blue-50"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                  title={isDistribuido ? "Redistribuir / Atualizar este item" : "Distribuir apenas este item agora"}
                >
                  <Zap className="w-3 h-3" />
                  {isDistribuido ? "Redistribuir" : "Distribuir"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
