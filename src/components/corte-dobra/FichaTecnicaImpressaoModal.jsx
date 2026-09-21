import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CroquiPeca2D from "./CroquiPeca2D";
import { calcularParametrosDobra } from "./CalculadoraForcaDobra";

export default function FichaTecnicaImpressaoModal({ open, onClose, dev }) {
  const printAreaRef = useRef(null);

  if (!dev) return null;

  const dobras = dev.dobras_json ? JSON.parse(dev.dobras_json) : [];
  const abas = dev.abas_json ? JSON.parse(dev.abas_json) : [25, 50, 25];

  const paramsDobra = calcularParametrosDobra({
    espessura_mm: dev.espessura_mm || 1.5,
    comprimento_mm: dev.comprimento_final_mm || 3000,
    material: dev.material || "Aço galvanizado",
  });

  const handleImprimir = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        {/* Barra superior de ações (não sai na impressão) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-20 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-base">Ficha Técnica de Produção — {dev.nome_peca}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleImprimir} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold">
              <Printer className="w-4 h-4" /> Imprimir Ficha A4
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Conteúdo da Ficha Técnica (Formatado para A4 e Impressão) */}
        <div ref={printAreaRef} className="p-8 bg-white text-slate-900 print:p-4 print:text-black space-y-6">
          {/* Cabeçalho da Empresa */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">AJL FERRO & AÇO</h1>
              <p className="text-xs uppercase tracking-widest text-slate-600 font-bold">
                Setor de Corte & Dobra · Instrução Técnica de Trabalho
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-100 border border-slate-300 rounded px-3 py-1 text-xs font-mono font-bold">
                {dev.numero || `DEV-${dev.id?.slice(0, 6)?.toUpperCase() || "001"}`}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Data: {format(new Date(dev.created_date || new Date()), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Dados do Pedido e Cliente */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Peça / Produto:</span>
              <p className="font-black text-sm text-slate-900">{dev.nome_peca}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Pedido / Cliente:</span>
              <p className="font-bold text-slate-800">
                {dev.numero_pedido ? `#${dev.numero_pedido}` : "Estoque / Interno"}{" "}
                {dev.cliente ? `· ${dev.cliente}` : ""}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Quantidade:</span>
              <p className="font-black text-sm text-orange-600">{dev.quantidade_peca || 1} peças</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Responsável:</span>
              <p className="font-bold text-slate-800">{dev.responsavel || "Engenharia AJL"}</p>
            </div>
          </div>

          {/* Especificações de Matéria-Prima e Máquinas */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs border border-slate-200 rounded-lg p-3 text-center bg-slate-50/50">
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Material</span>
              <p className="font-bold text-slate-900 mt-0.5">{dev.material || "Aço Galv."}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Espessura</span>
              <p className="font-bold text-slate-900 mt-0.5">{dev.espessura_mm} mm</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Blank (Planif.)</span>
              <p className="font-black text-orange-600 mt-0.5">{dev.comprimento_desenvolvido_mm} mm</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Comprimento</span>
              <p className="font-bold text-slate-900 mt-0.5">{dev.comprimento_final_mm || 3000} mm</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Máq. Corte</span>
              <p className="font-bold text-purple-700 mt-0.5">{dev.maquina_corte || "CORTE 6M"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Máq. Dobra</span>
              <p className="font-bold text-blue-700 mt-0.5">{dev.maquina_dobra || "DOBRA 6M"}</p>
            </div>
          </div>

          {/* Croqui 2D do Perfil */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-900 text-white">
            <h3 className="text-xs uppercase font-bold text-slate-300 tracking-wider mb-2">
              Desenho do Perfil & Abas (Vista em Seção)
            </h3>
            <CroquiPeca2D
              abas={abas}
              dobras={dobras}
              espessura_mm={dev.espessura_mm || 1.5}
              nomePeca={dev.nome_peca}
              larguraPlanificada={dev.comprimento_desenvolvido_mm || 100}
              comprimento_mm={dev.comprimento_final_mm || 3000}
            />
          </div>

          {/* Tabela de Sequência de Dobras Passo a Passo */}
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-800 tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              Sequência de Dobras Recomendada para o Operador
            </h3>
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 text-center w-14">Dobra</th>
                    <th className="p-2.5">Aba / Descrição</th>
                    <th className="p-2.5 text-center">Ângulo</th>
                    <th className="p-2.5 text-center">Matriz V</th>
                    <th className="p-2.5 text-center">Raio (Ri)</th>
                    <th className="p-2.5 text-center">Aba Mínima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dobras.map((d, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="p-2.5 text-center font-black text-orange-600">D{idx + 1}</td>
                      <td className="p-2.5 font-medium">{d.descricao || `Dobra ${idx + 1}`}</td>
                      <td className="p-2.5 text-center font-bold">{d.angulo}°</td>
                      <td className="p-2.5 text-center font-mono font-bold text-blue-700">V {paramsDobra.vRecomendado} mm</td>
                      <td className="p-2.5 text-center text-slate-600">R {paramsDobra.raioInternoMm} mm</td>
                      <td className="p-2.5 text-center text-emerald-700 font-semibold">{paramsDobra.abaMinimaMm} mm</td>
                    </tr>
                  ))}
                  {dobras.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                        Sem dobras cadastradas para esta peça (somente corte de chapa).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parâmetros de Prensa Dobradeira */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
            <span className="font-bold text-amber-900">⚠️ Instruções de Segurança e Setup da Máquina:</span>
            <p className="text-amber-800 text-[11px]">
              • Força estimada calculada: <strong>{paramsDobra.tonsTotal} toneladas</strong> (~{paramsDobra.tonsPorMetro} t/m).
              Certifique-se de centralizar a peça na mesa da dobradeira para evitar torção dos cilindros hidráulicos.
            </p>
            <p className="text-amber-800 text-[11px]">
              • Matriz inferior recomendada: <strong>Canal V {paramsDobra.vRecomendado} mm</strong>. Nunca utilize canal menor que {paramsDobra.abaMinimaMm} mm sem conferência do técnico.
            </p>
            {dev.observacoes_tecnicas && (
              <p className="text-slate-700 text-[11px] pt-1 border-t border-amber-200 mt-1">
                <strong>Observações Especiais:</strong> {dev.observacoes_tecnicas}
              </p>
            )}
          </div>

          {/* Campo de Assinaturas e Liberação */}
          <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-300 text-xs">
            <div className="text-center">
              <div className="border-b border-slate-400 h-10 mb-1" />
              <span className="font-bold text-slate-800">Operador Responsável (Corte / Dobra)</span>
              <p className="text-[10px] text-slate-500">Data: ____/____/________</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-400 h-10 mb-1" />
              <span className="font-bold text-slate-800">Controle de Qualidade / Expedição</span>
              <p className="text-[10px] text-slate-500">Visto de Liberação</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
