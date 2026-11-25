import React, { useMemo } from "react";
import { Camera } from "lucide-react";
import SmartImage from "@/components/ui/SmartImage";
import { opDaMesmaOf } from "@/lib/opVinculoSeguro";

// Fotos que os operadores tiram no chão de fábrica, por campo da OP/OF.
const CAMPOS = [
  { key: "foto_pedido_url", label: "Pedido", badge: "bg-blue-600" },
  { key: "foto_etiqueta_bobina_url", label: "Etiqueta Bobina", badge: "bg-orange-600" },
  { key: "foto_etiqueta_chapa_url", label: "Etiqueta Chapa", badge: "bg-orange-600" },
  { key: "foto_material_url", label: "Material", badge: "bg-amber-600" },
  { key: "foto_eps_url", label: "EPS", badge: "bg-cyan-600" },
  { key: "foto_finalizacao_url", label: "Finalização", badge: "bg-emerald-600" },
  { key: "retrabalho_foto_1_url", label: "Retrabalho 1", badge: "bg-rose-600" },
  { key: "retrabalho_foto_2_url", label: "Retrabalho 2", badge: "bg-rose-600" },
  { key: "foto_carregamento_url", label: "Carregamento", badge: "bg-indigo-600" },
];

/**
 * Galeria das fotos tiradas pelos operadores nas OPs desta OF
 * (pedido, etiqueta, material, finalização, retrabalho e carregamento).
 */
export default function FotosProducaoPedido({ pedido, pedidosProducao = [], ordensCD = [] }) {
  const fotos = useMemo(() => {
    if (!pedido) return [];
    const ops = [...(pedidosProducao || []), ...(ordensCD || [])].filter(op => opDaMesmaOf(op, pedido));
    const vistas = new Set();
    const lista = [];
    for (const fonte of [pedido, ...ops]) {
      for (const campo of CAMPOS) {
        const url = fonte?.[campo.key];
        if (!url || typeof url !== "string" || vistas.has(url)) continue;
        vistas.add(url);
        lista.push({ url, label: campo.label, badge: campo.badge, of: fonte?.of_nome || "" });
      }
    }
    return lista;
  }, [pedido, pedidosProducao, ordensCD]);

  if (!fotos.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
      <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Fotos da Produção ({fotos.length})
          </span>
        </div>
        <span className="text-[10px] text-slate-500">Toque para ampliar</span>
      </div>
      <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {fotos.map((f, i) => (
          <div key={`${f.url}-${i}`} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <SmartImage
              src={f.url}
              alt={`${f.label}${f.of ? ` ${f.of}` : ""}`}
              className="w-full h-28"
              imgClassName="w-full h-full object-cover"
              clickable
            />
            <span className={`absolute top-1 left-1 ${f.badge} text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow pointer-events-none`}>
              {f.label}
            </span>
            {f.of && (
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded pointer-events-none">
                {f.of}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}