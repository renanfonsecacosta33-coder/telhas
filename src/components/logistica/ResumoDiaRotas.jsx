import React, { useMemo } from "react";
import { Truck, Package, CameraOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { contarFotos } from "@/lib/rotaDataHelper";

export default function ResumoDiaRotas({ rotas = [], dataSelecionada = null }) {
  const resumo = useMemo(() => {
    let pedidos = 0;
    let semFoto = 0;
    rotas.forEach((r) => {
      try {
        const arr = JSON.parse(r.itens_json || "[]");
        pedidos += Array.isArray(arr) ? arr.length : 0;
      } catch {}
      if (contarFotos(r) === 0) semFoto += 1;
    });
    return { rotas: rotas.length, pedidos, semFoto };
  }, [rotas]);

  const labelDia = dataSelecionada
    ? format(parseISO(dataSelecionada), "EEEE, dd 'de' MMMM", { locale: ptBR })
    : "Todas as datas";

  const cards = [
    { label: "Rotas", valor: resumo.rotas, Icone: Truck, cor: "text-blue-600" },
    { label: "Pedidos", valor: resumo.pedidos, Icone: Package, cor: "text-emerald-600" },
    { label: "Sem foto", valor: resumo.semFoto, Icone: CameraOff, cor: "text-amber-600" },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold capitalize flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> {labelDia}
        </h2>
        <span className="text-[11px] text-muted-foreground">Resumo do dia</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map(({ label, valor, Icone, cor }) => (
          <div key={label} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Icone className={`w-3.5 h-3.5 ${cor}`} /> {label}
            </div>
            <p className={`text-xl font-black leading-tight ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}