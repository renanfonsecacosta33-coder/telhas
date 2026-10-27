import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MAQUINAS_TELHAS = [
  { nome: "TP - 40", rota: "/maquina/tp40" },
  { nome: "TP - 25", rota: "/maquina/tp25" },
  { nome: "ONDULADA", rota: "/maquina/ondulada" },
  { nome: "COLONIAL", rota: "/maquina/colonial" },
  { nome: "BANDEJA", rota: "/maquina/bandeja" },
  { nome: "DESBOBINADOR", rota: "/maquina/desbobinador" },
  { nome: "CUMEEIRA", rota: "/maquina/cumeeira" },
  { nome: "COLAGEM", rota: "/maquina/colagem" },
];

/**
 * Troca rápida entre as máquinas de Telhas — visível apenas para
 * administradores/gestores que circulam entre os painéis.
 */
export default function MaquinaSwitcherAdmin({ maquinaAtual }) {
  const outras = MAQUINAS_TELHAS.filter(m => m.nome !== maquinaAtual);
  if (outras.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
          Ir para máquina:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {outras.map(m => (
            <Link
              key={m.nome}
              to={m.rota}
              className={cn(
                "flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                "bg-muted/40 hover:bg-primary hover:text-primary-foreground hover:border-primary text-foreground border-border/70 cursor-pointer"
              )}
              title={`Abrir painel da ${m.nome}`}
            >
              {m.nome}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}