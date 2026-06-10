import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pencil, Trash2, Archive, ArchiveRestore, AlertTriangle, Clock,
  Weight, Ruler, CalendarDays, FileCheck, ShieldCheck,
  ChevronDown, ChevronUp, Lock, LockOpen, Camera
} from "lucide-react";

export const qualidadeColors = {
  "GV": "bg-blue-100 text-blue-800 border-blue-300",
  "PP": "bg-pink-100 text-pink-800 border-pink-300",
  "FF": "bg-gray-100 text-gray-700 border-gray-300",
  "FQ": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "ALZ": "bg-orange-100 text-orange-800 border-orange-300",
};

export const qualidadeNomes = {
  "GV": "Galvanizado",
  "PP": "Pré-pintado",
  "FF": "Fina Fria",
  "FQ": "Fina Quente",
  "ALZ ( IMP )": "Aluminizada (Imp.)",
};

export function getPorcentagemUso(bobina) {
  if (!bobina.peso_inicial || !bobina.peso_kg) return null;
  const usado = bobina.peso_inicial - bobina.peso_kg;
  return Math.min(100, Math.max(0, (usado / bobina.peso_inicial) * 100));
}

export function getPrevisaoAcabar(bobina) {
  if (!bobina.consumo_diario_kg || !bobina.peso_kg || bobina.consumo_diario_kg <= 0) return null;
  return Math.round(bobina.peso_kg / bobina.consumo_diario_kg);
}

export function getAlertaNivel(bobina) {
  if (!bobina.estoque_minimo_kg || !bobina.peso_kg) return null;
  if (bobina.peso_kg <= bobina.estoque_minimo_kg) return "critico";
  if (bobina.peso_kg <= bobina.estoque_minimo_kg * 1.3) return "atencao";
  return null;
}

function BarraProgresso({ pct, alerta }) {
  const cor = alerta === "critico" ? "bg-red-500" : alerta === "atencao" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BobinaCard({ bobina, onEdit, onDelete, onArquivar, statusColors = {} }) {
  const [expandido, setExpandido] = useState(false);
  const pctUso = getPorcentagemUso(bobina);
  const pctRestante = pctUso !== null ? 100 - pctUso : null;
  const diasRestantes = getPrevisaoAcabar(bobina);
  const alerta = getAlertaNivel(bobina);
  const custoTotal = bobina.custo && bobina.peso_kg ? bobina.custo * bobina.peso_kg : null;

  const reservaPct = bobina.reservada && bobina.reserva_tipo === "parcial" && bobina.reserva_kg && bobina.peso_kg
    ? Math.min(100, (bobina.reserva_kg / bobina.peso_kg) * 100)
    : null;

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition-all ${
      bobina.reservada ? "border-purple-400" :
      alerta === "critico" ? "border-red-300" :
      alerta === "atencao" ? "border-amber-300" : "border-border"
    }`}>

      {/* Banner reserva */}
      {bobina.reservada && (
        <div className="px-4 py-2 rounded-t-xl flex items-center gap-2 text-xs font-semibold bg-purple-50 text-purple-800 border-b border-purple-200">
          <Lock className="w-3.5 h-3.5" />
          <span>RESERVADA — {bobina.reserva_tipo === "inteira" ? "Bobina Inteira" : `${bobina.reserva_kg?.toLocaleString("pt-BR")} kg (${reservaPct?.toFixed(0)}%)`}</span>
          {bobina.reserva_numero_pedido && <span className="ml-1">· Pedido: <strong>{bobina.reserva_numero_pedido}</strong></span>}
          {bobina.reserva_autorizado_por && <span className="ml-auto text-purple-600">Autorizado: {bobina.reserva_autorizado_por}</span>}
        </div>
      )}

      {/* Alerta estoque */}
      {!bobina.reservada && alerta && (
        <div className={`px-4 py-2 rounded-t-xl flex items-center gap-2 text-xs font-semibold ${alerta === "critico" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {alerta === "critico" ? "⚠ Estoque abaixo do mínimo!" : "⚠ Estoque próximo do mínimo"}
          {diasRestantes !== null && <span className="ml-auto">Previsão: {diasRestantes} dias</span>}
        </div>
      )}

      <div className="p-4">
        {/* Linha principal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-gray-900">{bobina.cor}</span>
              {bobina.qualidade && (
                <Badge variant="outline" className={`text-xs font-bold ${qualidadeColors[bobina.qualidade] || ""}`}>
                  {bobina.qualidade} · {qualidadeNomes[bobina.qualidade] || bobina.qualidade}
                </Badge>
              )}
              {bobina.status && (
                <Badge variant="outline" className={`text-xs ${statusColors[bobina.status] || ""}`}>{bobina.status}</Badge>
              )}
              {bobina.reservada && (
                <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300">
                  <Lock className="w-2.5 h-2.5 mr-1" />Reservada
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {bobina.codigo && <span className="font-mono font-semibold text-gray-700">{bobina.codigo}</span>}
              <span>Chapa: <strong className="text-gray-700">{bobina.chapa} mm</strong></span>
              {bobina.largura_mm && <span>Largura: <strong className="text-gray-700">{bobina.largura_mm} mm</strong></span>}
              {bobina.fornecedor && <span>· {bobina.fornecedor}</span>}
              {bobina.data_recebimento && (
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{bobina.data_recebimento}</span>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 shrink-0">
            {!bobina.arquivada ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" title="Arquivar" onClick={() => onArquivar(bobina.id, true)}>
                <Archive className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" title="Restaurar" onClick={() => onArquivar(bobina.id, false)}>
                <ArchiveRestore className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(bobina)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(bobina)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Métricas */}
        <div className={`mt-4 grid gap-3 ${bobina.setor === "corte_dobra" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Weight className="w-3 h-3" />Peso Atual</p>
            <p className="text-lg font-bold text-gray-900">{bobina.peso_kg ? bobina.peso_kg.toLocaleString("pt-BR") : "—"}</p>
            <p className="text-xs text-muted-foreground">kg</p>
          </div>
          {bobina.setor !== "corte_dobra" && (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Ruler className="w-3 h-3" />Metragem</p>
            <p className="text-lg font-bold text-gray-900">{bobina.metragem ? bobina.metragem.toLocaleString("pt-BR") : "—"}</p>
            <p className="text-xs text-muted-foreground">metros</p>
          </div>
          )}
          <div className={`rounded-lg p-3 text-center ${alerta === "critico" ? "bg-red-50" : alerta === "atencao" ? "bg-amber-50" : "bg-gray-50"}`}>
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" />Estoque Mín.</p>
            <p className={`text-lg font-bold ${alerta === "critico" ? "text-red-700" : alerta === "atencao" ? "text-amber-700" : "text-gray-900"}`}>
              {bobina.estoque_minimo_kg ? bobina.estoque_minimo_kg.toLocaleString("pt-BR") : "—"}
            </p>
            <p className="text-xs text-muted-foreground">kg</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${diasRestantes !== null && diasRestantes <= 7 ? "bg-red-50" : diasRestantes !== null && diasRestantes <= 15 ? "bg-amber-50" : "bg-gray-50"}`}>
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />Previsão</p>
            <p className={`text-lg font-bold ${diasRestantes !== null && diasRestantes <= 7 ? "text-red-700" : diasRestantes !== null && diasRestantes <= 15 ? "text-amber-700" : "text-gray-900"}`}>
              {diasRestantes !== null ? diasRestantes : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{diasRestantes !== null ? "dias" : "sem consumo"}</p>
          </div>
        </div>

        {/* Barra reserva parcial */}
        {bobina.reservada && bobina.reserva_tipo === "parcial" && reservaPct !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="text-purple-700 font-semibold">Reservado: {bobina.reserva_kg?.toLocaleString("pt-BR")} kg ({reservaPct.toFixed(0)}%)</span>
              <span>Livre: {(bobina.peso_kg - bobina.reserva_kg).toLocaleString("pt-BR")} kg</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-purple-500" style={{ width: `${reservaPct}%` }} />
            </div>
          </div>
        )}

        {/* Barra de uso */}
        {pctRestante !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Consumido: {pctUso.toFixed(0)}%</span>
              <span className="font-semibold text-gray-700">Restante: {pctRestante.toFixed(0)}%</span>
              {bobina.peso_inicial && <span>Inicial: {bobina.peso_inicial.toLocaleString("pt-BR")} kg</span>}
            </div>
            <BarraProgresso pct={pctRestante} alerta={alerta} />
          </div>
        )}

        {/* Expandir */}
        <button
          onClick={() => setExpandido(!expandido)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expandido ? "Menos detalhes" : "Mais detalhes"}
        </button>

        {/* Detalhes expandidos */}
        {expandido && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            {/* Info reserva completa */}
            {bobina.reservada && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-1 text-xs">
                <p className="font-semibold text-purple-800 flex items-center gap-1"><Lock className="w-3 h-3" />Detalhes da Reserva</p>
                {bobina.reserva_motivo && <p className="text-purple-700"><span className="text-muted-foreground">Motivo:</span> {bobina.reserva_motivo}</p>}
                {bobina.reserva_numero_pedido && <p className="text-purple-700"><span className="text-muted-foreground">Pedido:</span> {bobina.reserva_numero_pedido}</p>}
                {bobina.reserva_autorizado_por && <p className="text-purple-700"><span className="text-muted-foreground">Autorizado por:</span> {bobina.reserva_autorizado_por}</p>}
                {bobina.reserva_data && <p className="text-purple-700"><span className="text-muted-foreground">Data:</span> {bobina.reserva_data}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {bobina.nf && <div><span className="text-muted-foreground">NF:</span> <strong>{bobina.nf}</strong></div>}
              {bobina.custo && <div><span className="text-muted-foreground">Custo/kg:</span> <strong>R$ {Number(bobina.custo).toFixed(2)}</strong></div>}
              {custoTotal && <div><span className="text-muted-foreground">Valor estoque:</span> <strong>R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>}
              {bobina.consumo_diario_kg && <div><span className="text-muted-foreground">Consumo/dia:</span> <strong>{bobina.consumo_diario_kg} kg</strong></div>}
              {bobina.setor !== "corte_dobra" && bobina.metragem_restante && <div><span className="text-muted-foreground">Metr. restante:</span> <strong>{bobina.metragem_restante} m</strong></div>}
              {bobina.data_encerramento && <div><span className="text-muted-foreground">Encerrada em:</span> <strong>{bobina.data_encerramento}</strong></div>}
            </div>

            {bobina.observacoes && (
              <p className="text-xs text-muted-foreground bg-gray-50 rounded-lg px-3 py-2">{bobina.observacoes}</p>
            )}

            {/* Anexos */}
            <div className="flex gap-2 flex-wrap">
              {bobina.anexo_nf_url && (
                <a href={bobina.anexo_nf_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium">
                  <FileCheck className="w-3.5 h-3.5" /> NF
                </a>
              )}
              {bobina.anexo_cert_url && (
                <a href={bobina.anexo_cert_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> Certificado
                </a>
              )}
              {bobina.anexo_cert_ausencia && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 font-medium">
                  ⚠ Sem cert. — {bobina.anexo_cert_ausencia}
                </span>
              )}
              {bobina.foto_adicional_url && (
                <a href={bobina.foto_adicional_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors font-medium">
                  <Camera className="w-3.5 h-3.5" /> Foto adicional
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}