import React from "react";
import { Globe, ShieldCheck } from "lucide-react";

/**
 * Determina se uma bobina é Nacional ou Importada a partir dos dados do objeto,
 * texto descritivo e exigência da OP.
 */
export function detectarOrigemAco({ bobina = null, bobinaTexto = "", origemExigida = null }) {
  // 1. Objeto Bobina com campo de origem explícito
  if (bobina?.origem) {
    const isImp = String(bobina.origem).toLowerCase().includes("import");
    return {
      origem: isImp ? "Importado" : "Nacional",
      label: isImp ? "Aço Importado" : "Aço Nacional",
      isImportado: isImp,
      confianca: "alta",
      detalhe: bobina.qualidade ? `Qualidade: ${bobina.qualidade}` : null
    };
  }

  // 2. Qualidade da bobina (ex: "GL (IMP)")
  if (bobina?.qualidade) {
    const qUpper = String(bobina.qualidade).toUpperCase();
    if (qUpper.includes("IMP")) {
      return {
        origem: "Importado",
        label: "Aço Importado",
        isImportado: true,
        confianca: "alta",
        detalhe: `Qualidade: ${bobina.qualidade}`
      };
    }
  }

  // 3. Verificação no texto descritivo da bobina (ex: "TE0137 0,43 (GV) (IMP) — Natural")
  const txt = String(bobinaTexto || "").toUpperCase();
  if (txt.includes("(IMP)") || txt.includes("IMPORTAD") || txt.includes("IMP.")) {
    return {
      origem: "Importado",
      label: "Aço Importado",
      isImportado: true,
      confianca: "media",
      detalhe: "Identificado pelo código/descrição"
    };
  }
  if (txt.includes("NACIONAL") || txt.includes("(NAC)") || txt.includes("CSN") || txt.includes("ARCELOR")) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "media",
      detalhe: "Identificado pelo código/descrição"
    };
  }

  // 4. Origem exigida pela OP / Pedido (ex: vindo do Odoo)
  if (origemExigida && origemExigida !== "ambas") {
    const isImp = String(origemExigida).toLowerCase().includes("import");
    return {
      origem: isImp ? "Importado" : "Nacional",
      label: isImp ? "Aço Importado (Exigido)" : "Aço Nacional (Exigido)",
      isImportado: isImp,
      confianca: "media",
      detalhe: `Requisito da OP: ${origemExigida}`
    };
  }

  // 5. Se temos o objeto bobina cadastrado mas sem tag importada, na AJL o padrão de chapa/bobina é Nacional
  if (bobina) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "padrao",
      detalhe: bobina.qualidade ? `Qualidade: ${bobina.qualidade}` : "Padrão Usina Nacional"
    };
  }

  // Fallback quando não há informação suficiente
  return {
    origem: "Nacional",
    label: "Aço Nacional",
    isImportado: false,
    confianca: "padrao",
    detalhe: "Padrão Usina Nacional"
  };
}

export default function BadgeOrigemAco({
  bobina = null,
  bobinaTexto = "",
  origemExigida = null,
  size = "default", // "sm" | "default" | "lg"
  className = ""
}) {
  const info = detectarOrigemAco({ bobina, bobinaTexto, origemExigida });

  const isImp = info.isImportado;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    default: "text-xs px-2.5 py-0.5 gap-1.5",
    lg: "text-sm px-3 py-1 gap-2 font-bold"
  }[size] || "text-xs px-2 py-0.5 gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-xs transition-all ${sizeClasses} ${
        isImp
          ? "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-700"
          : "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700"
      } ${className}`}
      title={info.detalhe ? `${info.label} (${info.detalhe})` : info.label}
    >
      <span className="text-sm leading-none" role="img" aria-label={info.origem}>
        {isImp ? "🌐" : "🇧🇷"}
      </span>
      <span>{info.label}</span>
      {info.detalhe && (
        <span className="opacity-70 font-normal text-[10px] hidden sm:inline">
          · {info.detalhe}
        </span>
      )}
    </span>
  );
}
