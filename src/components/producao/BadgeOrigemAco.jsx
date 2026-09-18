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

  // 3. Verificação no texto descritivo da bobina (ex: "TE0137 0,43 (GV) — Natural - 4000kg")
  const txt = String(bobinaTexto || "").toUpperCase();
  if (txt.includes("(IMP)") || txt.includes("IMPORTAD") || txt.includes("IMP.") || txt.includes("GL (IMP)")) {
    return {
      origem: "Importado",
      label: "Aço Importado",
      isImportado: true,
      confianca: "alta",
      detalhe: "Qualidade: Importado (GL IMP)"
    };
  }
  if (txt.includes("(GV)") || txt.includes(" GALVALUME") || txt.includes("GALV")) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "alta",
      detalhe: "Qualidade: Galvalume (GV) Nacional"
    };
  }
  if (txt.includes("(PP)") || txt.includes("PRE-PINTADO") || txt.includes("PRÉ-PINTADO")) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "alta",
      detalhe: "Qualidade: Pré-Pintado (PP) Nacional"
    };
  }
  if (txt.includes("(FF)") || txt.includes("FLANDRES")) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "alta",
      detalhe: "Qualidade: Frio (FF) Nacional"
    };
  }
  if (txt.includes("(FQ)") || txt.includes("FITA QUENTE")) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "alta",
      detalhe: "Qualidade: Fita Quente (FQ) Nacional"
    };
  }
  if (txt.includes("NACIONAL") || txt.includes("(NAC)") || txt.includes("CSN") || txt.includes("ARCELOR")) {
    return {
      origem: "Nacional",
      label: "Aço Nacional",
      isImportado: false,
      confianca: "alta",
      detalhe: "Usina Nacional"
    };
  }

  // 4. Origem exigida pela OP / Pedido (ex: vindo do Odoo)
  if (origemExigida && origemExigida !== "ambas") {
    const isImp = String(origemExigida).toLowerCase().includes("import");
    return {
      origem: isImp ? "Importado" : "Nacional",
      label: isImp ? "Aço Importado" : "Aço Nacional",
      isImportado: isImp,
      confianca: "alta",
      detalhe: `Exigência Odoo: ${origemExigida}`
    };
  }

  // 5. Se temos o objeto bobina cadastrado mas sem tag importada, na AJL o padrão é Nacional
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
  size = "default", // "sm" | "default" | "lg" | "destaque"
  className = ""
}) {
  const info = detectarOrigemAco({ bobina, bobinaTexto, origemExigida });
  const isImp = info.isImportado;

  // Modo Destaque: Banner visual grande, de altíssimo contraste
  if (size === "destaque") {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 shadow-xs transition-all ${
          isImp
            ? "bg-sky-100 dark:bg-sky-950 text-sky-950 dark:text-sky-100 border-sky-500"
            : "bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100 border-emerald-500"
        } ${className}`}
      >
        <span className="text-2xl leading-none" role="img" aria-label={info.origem}>
          {isImp ? "🌐" : "🇧🇷"}
        </span>
        <div className="leading-tight">
          <span className="block font-black text-xs uppercase tracking-wider">
            {info.label}
          </span>
          <span className="block text-[11px] font-semibold opacity-85">
            {info.detalhe || (isImp ? "Aço Importado (GL IMP)" : "Aço Nacional CSN/Arcelor")}
          </span>
        </div>
      </div>
    );
  }

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    default: "text-xs px-2.5 py-0.5 gap-1.5",
    lg: "text-sm px-3 py-1 gap-2 font-bold"
  }[size] || "text-xs px-2 py-0.5 gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border-2 shadow-xs transition-all ${sizeClasses} ${
        isImp
          ? "bg-sky-100 text-sky-900 border-sky-400 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-600"
          : "bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-600"
      } ${className}`}
      title={info.detalhe ? `${info.label} (${info.detalhe})` : info.label}
    >
      <span className="text-sm leading-none" role="img" aria-label={info.origem}>
        {isImp ? "🌐" : "🇧🇷"}
      </span>
      <span>{info.label}</span>
      {info.detalhe && (
        <span className="opacity-80 font-semibold text-[10px] hidden sm:inline">
          · {info.detalhe}
        </span>
      )}
    </span>
  );
}
