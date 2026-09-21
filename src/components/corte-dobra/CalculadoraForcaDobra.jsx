import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Info, Wrench, Gauge, ShieldAlert } from "lucide-react";

/**
 * Matrizes V padrão de mercado (mm)
 */
export const MATRIZES_V_PADRAO = [6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];

/**
 * Limites de capacidade das dobradeiras da AJL
 */
export const MAQUINAS_DOBRADEIRAS = {
  "DOBRA 3M": { capacidadeTons: 100, comprimentoMaxMm: 3200 },
  "DOBRA FUNDO 6M": { capacidadeTons: 220, comprimentoMaxMm: 6200 },
  "DOBRA INICIO 6M": { capacidadeTons: 220, comprimentoMaxMm: 6200 },
  "DOBRAdeira Manual": { capacidadeTons: 30, comprimentoMaxMm: 2000 },
};

/**
 * Calcula a força de dobra recomendada (toneladas) e parâmetros de ferramental
 */
export function calcularParametrosDobra({
  espessura_mm = 1.5,
  comprimento_mm = 3000,
  material = "Aço galvanizado",
  vManual = null,
}) {
  const e = Math.max(0.3, Number(espessura_mm) || 1.5);
  const l_metros = Math.max(0.1, (Number(comprimento_mm) || 3000) / 1000);

  // Resistência à tração (kg/mm²)
  let resistenciaKgMm2 = 42; // Aço carbono / Galvanizado padrão (420 MPa)
  if (material?.toLowerCase().includes("inox")) {
    resistenciaKgMm2 = 65; // Aço inox (650 MPa)
  } else if (material?.toLowerCase().includes("aluminio") || material?.toLowerCase().includes("alumínio")) {
    resistenciaKgMm2 = 25; // Alumínio (250 MPa)
  }

  // Sugestão de canal V
  // Para e <= 2.5: V ideal ~ 8 * e
  // Para e > 2.5: V ideal ~ 10 * e
  const multiplicadorV = e <= 2.5 ? 8 : 10;
  const vIdealCalculado = e * multiplicadorV;

  // Encontra a matriz padrão mais próxima
  let vRecomendado = MATRIZES_V_PADRAO.reduce((prev, curr) => {
    return Math.abs(curr - vIdealCalculado) < Math.abs(prev - vIdealCalculado) ? curr : prev;
  }, 16);

  const vUtilizado = vManual ? Number(vManual) : vRecomendado;

  // Raio interno resultante no ar: Ri ~ V / 6
  const raioInternoMm = Number((vUtilizado / 6).toFixed(2));

  // Aba mínima necessária para apoiar na matriz: b_min ~ 0.7 * V
  const abaMinimaMm = Math.ceil(0.7 * vUtilizado);

  // Força por metro (t/m): F = (1.42 * Rm * e²) / V
  // (Fórmula universal para dobra no ar de chapa de aço)
  const tonsPorMetro = (1.42 * resistenciaKgMm2 * Math.pow(e, 2)) / vUtilizado;
  const tonsTotal = tonsPorMetro * l_metros;

  return {
    vRecomendado,
    vUtilizado,
    raioInternoMm,
    abaMinimaMm,
    tonsPorMetro: Number(tonsPorMetro.toFixed(1)),
    tonsTotal: Number(tonsTotal.toFixed(1)),
    resistenciaKgMm2,
  };
}

export default function CalculadoraForcaDobra({
  espessura_mm = 1.5,
  comprimento_mm = 3000,
  material = "Aço galvanizado",
  maquinaSelecionada = "DOBRA FUNDO 6M",
  className = "",
}) {
  const params = useMemo(() => {
    return calcularParametrosDobra({ espessura_mm, comprimento_mm, material });
  }, [espessura_mm, comprimento_mm, material]);

  const maquinaConfig = MAQUINAS_DOBRADEIRAS[maquinaSelecionada] || { capacidadeTons: 150 };
  const percentualCapacidade = (params.tonsTotal / maquinaConfig.capacidadeTons) * 100;
  const limiteExcedido = params.tonsTotal > maquinaConfig.capacidadeTons;

  return (
    <div className={`bg-card border border-border rounded-xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-bold text-foreground">
            Parâmetros de Dobra & Ferramental
          </h3>
        </div>
        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
          {material || "Aço Padrão"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Matriz V Recomendada */}
        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Canal da Matriz (V)</span>
          <p className="text-base font-black text-orange-600 mt-0.5">V {params.vRecomendado} mm</p>
          <span className="text-[10px] text-muted-foreground">Padrão ~8× a 10× espessura</span>
        </div>

        {/* Raio Interno Resultante */}
        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Raio Interno (Ri)</span>
          <p className="text-base font-black text-sky-600 mt-0.5">R {params.raioInternoMm} mm</p>
          <span className="text-[10px] text-muted-foreground">Dobra ao ar (~V/6)</span>
        </div>

        {/* Aba Mínima */}
        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Aba Mínima de Apoio</span>
          <p className="text-base font-black text-emerald-600 mt-0.5">{params.abaMinimaMm} mm</p>
          <span className="text-[10px] text-muted-foreground">Evita cair no canal</span>
        </div>

        {/* Força / Tonelagem */}
        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Força Total Necessária</span>
          <p className={`text-base font-black mt-0.5 ${limiteExcedido ? "text-red-600" : "text-foreground"}`}>
            {params.tonsTotal} t
          </p>
          <span className="text-[10px] text-muted-foreground">({params.tonsPorMetro} t/metro)</span>
        </div>
      </div>

      {/* Alerta de Carga da Máquina */}
      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 ${
        limiteExcedido
          ? "bg-red-50 text-red-800 border-red-200"
          : percentualCapacidade > 80
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-emerald-50 text-emerald-800 border-emerald-200"
      }`}>
        {limiteExcedido ? (
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold">
              Carga na Máquina: <strong>{maquinaSelecionada}</strong> (Capacidade: {maquinaConfig.capacidadeTons} t)
            </span>
            <span className="font-bold">{percentualCapacidade.toFixed(0)}%</span>
          </div>
          {limiteExcedido ? (
            <p className="text-[11px] mt-0.5 font-medium">
              ⚠️ Alerta: A força necessária ({params.tonsTotal} t) ultrapassa a capacidade máxima desta máquina ({maquinaConfig.capacidadeTons} t). Aumente a matriz V ou utilize uma máquina de maior porte!
            </p>
          ) : (
            <p className="text-[11px] mt-0.5 opacity-90">
              Operação segura dentro da faixa de trabalho da dobradeira.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Especialista Técnico em Dobra de Chapas:
 * Analisa cada aba, cada dobra, as distâncias e as restrições mecânicas da máquina
 */
export function analisarViabilidadeDobra({
  abas = [],
  dobras = [],
  espessura_mm = 1.5,
  comprimento_mm = 3000,
  material = "Aço galvanizado",
  maquinaNome = "DOBRA FUNDO 6M",
}) {
  const params = calcularParametrosDobra({ espessura_mm, comprimento_mm, material });
  const { vRecomendado, abaMinimaMm, tonsTotal } = params;
  const maquinaConfig = MAQUINAS_DOBRADEIRAS[maquinaNome] || { capacidadeTons: 150, comprimentoMaxMm: 6200 };

  const erros = [];
  const avisos = [];
  const sucessos = [];
  const statusPorAba = {}; // abaIdx -> { valido: boolean, motivo?: string }
  const statusPorDobra = {}; // dobraIdx -> { valido: boolean, motivo?: string }

  // 1. Checagem de comprimento da barra vs capacidade da máquina
  const compReal = Number(comprimento_mm) || 3000;
  if (compReal > maquinaConfig.comprimentoMaxMm) {
    erros.push({
      tipo: "erro",
      titulo: "Comprimento excede a mesa da máquina",
      msg: `A peça (${compReal} mm) ultrapassa o comprimento útil da mesa da ${maquinaNome} (máx: ${maquinaConfig.comprimentoMaxMm} mm).`,
    });
  }

  // 2. Checagem de Tonelagem vs Máquina
  if (tonsTotal > maquinaConfig.capacidadeTons) {
    erros.push({
      tipo: "erro",
      titulo: "Força excede a dobradeira",
      msg: `Força necessária (${tonsTotal} t) ultrapassa a capacidade máxima da ${maquinaNome} (${maquinaConfig.capacidadeTons} t). Risco de quebra ou desarme da máquina!`,
    });
  } else if (tonsTotal > maquinaConfig.capacidadeTons * 0.85) {
    avisos.push({
      tipo: "aviso",
      titulo: "Carga alta na dobradeira",
      msg: `Operação próxima do limite da máquina (${((tonsTotal / maquinaConfig.capacidadeTons) * 100).toFixed(0)}% de carga). Recomenda-se aumentar a matriz V.`,
    });
  }

  // 3. Checagem de Aba Mínima (para cada aba)
  // A aba precisa apoiar nos dois lados do canal V da matriz
  abas.forEach((abaVal, i) => {
    const compAba = Number(abaVal) || 0;
    if (compAba < abaMinimaMm) {
      statusPorAba[i] = {
        valido: false,
        motivo: `Aba ${i + 1} (${compAba} mm) é menor que a aba mínima (${abaMinimaMm} mm) para a matriz V${vRecomendado}. A chapa vai cair dentro do canal V!`,
      };
      erros.push({
        tipo: "erro",
        abaIdx: i,
        titulo: `Aba ${i + 1} muito curta (${compAba} mm)`,
        msg: `Aba ${i + 1} tem apenas ${compAba} mm, mas a matriz V${vRecomendado} exige no mínimo ${abaMinimaMm} mm de apoio para não escorregar.`,
      });
    } else {
      statusPorAba[i] = { valido: true };
    }
  });

  // 4. Checagem de Distância Mínima entre Dobras Consecutivas
  // Se duas dobras estão muito próximas, a dobra anterior colide com a matriz V
  const distanciaMinimaEntreDobras = Math.ceil(vRecomendado * 0.85);
  for (let i = 0; i < dobras.length; i++) {
    const abaEntreDobras = Number(abas[i + 1]) || 0;
    if (i < dobras.length - 1 && abaEntreDobras < distanciaMinimaEntreDobras) {
      statusPorDobra[i] = {
        valido: false,
        motivo: `Distância entre dobra D${i + 1} e D${i + 2} (${abaEntreDobras} mm) é muito estreita para o canal V${vRecomendado} (mínimo: ${distanciaMinimaEntreDobras} mm).`,
      };
      avisos.push({
        tipo: "aviso",
        dobraIdx: i,
        titulo: `Dobras D${i + 1} e D${i + 2} muito próximas`,
        msg: `A aba intermediária (${abaEntreDobras} mm) pode colidir com a lateral da matriz V${vRecomendado} (recomendado mín. ${distanciaMinimaEntreDobras} mm).`,
      });
    } else {
      if (!statusPorDobra[i]) statusPorDobra[i] = { valido: true };
    }
  }

  // 5. Checagem de Ângulos (Bainha e Ângulos Fechados)
  dobras.forEach((d, i) => {
    const ang = Number(d.angulo) || 90;
    if (ang > 140) {
      avisos.push({
        tipo: "aviso",
        dobraIdx: i,
        titulo: `Dobra D${i + 1} (${ang}°) — Bainha / Esmagamento`,
        msg: `Ângulo obtuso de ${ang}°. Exige dois passos de conformação: dobra preliminar a 30° e posterior esmagamento em matriz de bainha.`,
      });
    } else if (ang < 30) {
      erros.push({
        tipo: "erro",
        dobraIdx: i,
        titulo: `Dobra D${i + 1} com ângulo excessivamente agudo (${ang}°)`,
        msg: `Ângulo de ${ang}° não pode ser feito no ar com punção padrão. Requer ferramental especial pontiagudo de 28°.`,
      });
    }
  });

  // 6. Checagem de Perfil Profundo (Colisão no Corpo do Punção)
  if (abas.length >= 3 && dobras.length >= 2) {
    const base = Number(abas[1]) || 0;
    const lateral1 = Number(abas[0]) || 0;
    const lateral2 = Number(abas[2]) || 0;
    if (base > 0 && (lateral1 > base * 2.0 || lateral2 > base * 2.0)) {
      avisos.push({
        tipo: "aviso",
        titulo: "Perfil com abas laterais profundas",
        msg: `As abas laterais (${Math.max(lateral1, lateral2)} mm) são muito altas em relação à base (${base} mm). Risco de colisão no avental/punção reto. Recomendado punção pescoço de ganso.`,
      });
    }
  }

  const ehDobravel = erros.length === 0;
  const status = erros.length > 0 ? "inviavel" : avisos.length > 0 ? "aviso" : "ok";

  if (ehDobravel && avisos.length === 0) {
    sucessos.push({
      tipo: "sucesso",
      titulo: "100% Viável para Produção",
      msg: `Todas as medidas atendem perfeitamente aos parâmetros da matriz V${vRecomendado}.`,
    });
  }

  return {
    ehDobravel,
    status,
    erros,
    avisos,
    sucessos,
    statusPorAba,
    statusPorDobra,
    params,
    vRecomendado,
    abaMinimaMm,
    tonsTotal,
  };
}
