import React from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, User, Tag, Layers, Hash, Ruler, Palette, Scale, Globe } from "lucide-react";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { PrioridadeBadge, isPedidoRetiraAgora, isPedidoRota } from "@/lib/prioridadeHelper";
import { detectarOrigemAco } from "@/components/producao/BadgeOrigemAco";

const STATUS_MINI = {
  pendente: { label: "Pendente", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  aguardando_material: { label: "Sem Material", cls: "bg-red-100 text-red-700 border-red-300" },
};

function CampoMini({ icon: Icon, label, value, destaque }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none tracking-wide">{label}</p>
        <p className={`text-xs font-semibold leading-tight truncate ${destaque ? "text-blue-700 dark:text-blue-400" : "text-foreground"}`}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function PedidoMiniCard({ pedido: p, onExpand }) {
  const st = STATUS_MINI[p.status] || STATUS_MINI.pendente;

  let variacoes = [];
  try { const v = JSON.parse(p.variacoes_telhas || "[]"); if (Array.isArray(v)) variacoes = v; } catch { variacoes = []; }
  const qtdPecas = variacoes.length > 0
    ? variacoes.reduce((s, v) => s + (Number(v.qty) || 0), 0)
    : (p.quantidade_telhas || 0);
  const qtdMedidas = variacoes.length > 0 ? variacoes.length : (p.metragem_mm ? 1 : 1);
  const totalMetros = calcularMetrosPedido(p);
  const espessura = p.espessura_exigida || (() => { const m = String(p.bobina_superior || p.bobina_descricao || "").match(/(\d+[.,]?\d*)\s*mm/i); return m ? m[1] : ""; })();
  const cor = p.cor_exigida || p.rvm_superior || "";
  const ehRetira = isPedidoRetiraAgora(p);
  const ehRota = isPedidoRota(p);

  return (
    <div
      onClick={onExpand}
      className="cursor-pointer group border border-slate-300 dark:border-slate-700 border-l-4 border-l-blue-500 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 shadow-xs hover:shadow-md hover:border-blue-400 transition-all"
    >
      {/* Linha 1: pedido + status + modelo + badges */}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black font-mono bg-blue-600 text-white tracking-wide">
          #{p.numero_pedido || String(p.id || "").slice(-6).toUpperCase()}
        </span>
        <Badge className={`border text-[10px] font-bold ${st.cls}`}>{st.label}</Badge>
        <span className="font-bold text-sm text-foreground">{p.produto || "TELHA"}</span>
        {p.modelo && <span className="text-xs text-muted-foreground">{p.modelo}</span>}
        <PrioridadeBadge pedido={p} />
        {ehRota && !ehRetira && (
          <Badge className="bg-indigo-600 text-white text-[10px] font-black gap-1">🚚 ROTA</Badge>
        )}
        {ehRetira && (
          <Badge className="bg-amber-500 text-white text-[10px] font-black gap-1">RETIRA AGORA</Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-muted-foreground group-hover:text-blue-600 transition-colors">
          Ver detalhes <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Linha 2: os 9 campos do resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5">
        <CampoMini icon={User} label="Cliente" value={p.cliente} />
        <CampoMini icon={Tag} label="Vendedor" value={p.vendedor || p.vendedor_nome} />
        <CampoMini icon={Hash} label="Qtd. Peças" value={String(qtdPecas || "—")} />
        <CampoMini icon={Layers} label="Medidas" value={String(qtdMedidas)} />
        <CampoMini icon={Ruler} label="Total" value={totalMetros > 0 ? `${Number(totalMetros).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} metros` : "—"} destaque />
        <CampoMini icon={Palette} label="Cor" value={cor} />
        <CampoMini icon={Scale} label="Espessura" value={espessura ? `${espessura} mm` : "—"} />
        <CampoMini
          icon={Globe}
          label="Origem"
          value={(() => {
            const info = detectarOrigemAco({ bobinaTexto: p.bobina_superior || p.bobina_descricao, origemExigida: p.origem_exigida });
            return info.isImportado ? "🌐 Importado" : "🇧🇷 Nacional";
          })()}
        />
      </div>
    </div>
  );
}