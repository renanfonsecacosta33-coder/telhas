import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Scissors, FileText, Send, CheckCircle2, Loader2, Package, Layers, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import { format } from "date-fns";
import CroquiPeca2D from "./CroquiPeca2D";
import AproveitamentoBlank from "./AproveitamentoBlank";

// ─── Tabela de blanks padrão da fábrica (digitalização da tabela impressa) ──
// Colunas: espessura 1,95 | 2,0 | 2,25 | 2,3 | 2,65 | 2,7 | 3,0 mm
const TABELA_BLANKS = {
  "25x50x25":          [92,  92,  91,  91,  89,  89,  88],
  "30x68x30":          [120, 120, 119, 119, 117, 117, 116],
  "38x75x38":          [143, 143, 142, 142, 140, 140, 139],
  "30x92x30":          [144, 144, 143, 143, 141, 141, 140],
  "40x100x40":         [172, 172, 171, 171, 169, 169, 168],
  "50x100x50":         [192, 192, 191, 191, 189, 189, 188],
  "50x125x50":         [217, 217, 216, 216, 214, 214, 213],
  "50x150x50":         [242, 242, 241, 241, 239, 239, 238],
  "50x200x50":         [292, 292, 291, 291, 289, 289, 288],
  "75x38 ENRRU.":      [171, 171, 169, 169, 166, 165, 173],
  "100x40 ENRRU.":     [200, 200, 198, 198, 195, 194, 202],
  "100x50 ENRRU.":     [220, 220, 218, 218, 215, 214, 222],
  "125x50 ENRRU.":     [245, 245, 243, 243, 240, 239, 247],
  "150x50 ENRRU.":     [270, 270, 268, 268, 265, 264, 272],
};
const ESP_COLS = [1.95, 2.0, 2.25, 2.3, 2.65, 2.7, 3.0];

function getBlanKPadrao(nomePeca, espessuramm) {
  if (!nomePeca || !espessuramm) return null;
  const espNum = parseFloat(espessuramm);
  for (const [perfil, blanks] of Object.entries(TABELA_BLANKS)) {
    const nomeUp = nomePeca.toUpperCase();
    const perfilUp = perfil.toUpperCase().replace("ENRRU.", "").trim();
    if (nomeUp.includes(perfilUp) || perfilUp.includes(nomeUp.split(" ")[0]?.replace(/[^0-9X]/g, ""))) {
      const colIdx = ESP_COLS.findIndex(e => Math.abs(e - espNum) < 0.1);
      if (colIdx >= 0) return { perfil, blank: blanks[colIdx] };
    }
  }
  return null;
}

const MAQUINAS_CORTE = ["CORTE 6M", "CORTE 3M"];
const MAQUINAS_DOBRA = ["DOBRA FUNDO 6M", "DOBRA INICIO 6M", "DOBRA 3M"];

export default function EnviarParaMaquinaModal({ open, onClose, dev, maquinaInicial, tipoInicial }) {
  const { filialAtiva } = useFilial();
  const [maquina, setMaquina] = useState(maquinaInicial || "CORTE 6M");
  const [quantidade, setQuantidade] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [cliente, setCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [abaVisual, setAbaVisual] = useState("croqui"); // "croqui" | "aproveitamento" | "tabela"

  // Atualiza máquina quando o modal muda de dev
  React.useEffect(() => {
    if (open) {
      setMaquina(maquinaInicial || "CORTE 6M");
      setQuantidade(dev?.quantidade_peca ? String(dev.quantidade_peca) : "1");
      setNumeroPedido(dev?.numero_pedido || "");
      setCliente(dev?.cliente || "");
      setObservacoes("");
      setEnviado(false);
      setAbaVisual("croqui");
    }
  }, [open, dev?.id, maquinaInicial]);

  // Query chapas para o combobox (caso necessário no futuro)
  const { data: chapas = [] } = useQuery({
    queryKey: ["chapas-cd-envio", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }),
    enabled: open,
  });
  const chapaVinculada = dev?.chapa_id
    ? chapas.find(c => c.id === dev.chapa_id)
    : null;

  if (!dev) return null;

  const dobras = dev.dobras_json ? JSON.parse(dev.dobras_json) : [];
  const abas = dev.abas_json ? JSON.parse(dev.abas_json) : [25, 50, 25];
  const isCorte = maquina?.includes("CORTE");
  const isDobra = maquina?.includes("DOBRA");

  // Consulta blank padrão da tabela da fábrica
  const blankPadrao = getBlanKPadrao(dev.nome_peca, dev.espessura_mm);

  const handleEnviar = async () => {
    if (!quantidade || isNaN(parseFloat(quantidade)) || parseFloat(quantidade) <= 0) {
      toast.error("Informe a quantidade de peças.");
      return;
    }
    setLoading(true);
    try {
      const comprimento_desenvolvido = dev.comprimento_desenvolvido_mm;
      const comprimento_final = dev.comprimento_final_mm || 3000;

      const ordemData = {
        data: format(new Date(), "yyyy-MM-dd"),
        maquina,
        tipo_peca: dev.nome_peca,
        dimensoes_livres: comprimento_desenvolvido
          ? `${comprimento_desenvolvido}×${comprimento_final}mm`
          : `${comprimento_final}mm`,
        numero_pedido: numeroPedido || dev.numero_pedido || undefined,
        cliente: cliente || dev.cliente || undefined,
        quantidade: parseFloat(quantidade),
        chapa_cd_id: dev.chapa_id || undefined,
        chapa_descricao: chapaVinculada
          ? `${chapaVinculada.codigo} · e${dev.espessura_mm}mm`
          : (dev.chapa_codigo ? `${dev.chapa_codigo} · e${dev.espessura_mm}mm` : undefined),
        chapa_origem: "chaparia",
        observacoes: observacoes || undefined,
        desenvolvimento_id: dev.id,
        desenvolvimento_descricao: `${dev.nome_peca} — ${dev.material || ""} ${dev.espessura_mm || ""}mm`,
        status: "pendente",
        unidade: filialAtiva,
      };

      // Se for corte e tem dobra definida, vincula a dobra automaticamente
      if (isCorte && dev.maquina_dobra && dev.maquina_dobra !== "PERFILADEIRA") {
        ordemData.ordem_dobra_maquina = dev.maquina_dobra;
      }

      await base44.entities.OrdemMaquinaCD.create(ordemData);
      setEnviado(true);
      toast.success(
        `✅ OP enviada para ${maquina}! O operador já pode ver o desenho e os dados da peça.`
      );
    } catch (e) {
      toast.error("Erro ao criar OP: " + (e.message || e));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5 text-orange-500" />
            Enviar para Produção — {dev.nome_peca}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            O operador receberá o desenho 2D, blank e parâmetros automaticamente na tela da máquina.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badges de identificação */}
          <div className="flex flex-wrap gap-2 items-center">
            {dev.espessura_mm && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 font-bold">
                e{dev.espessura_mm} mm
              </Badge>
            )}
            {dev.material && (
              <Badge variant="outline" className="text-slate-700">
                <Layers className="w-3 h-3 mr-1" />{dev.material}
              </Badge>
            )}
            {dev.comprimento_desenvolvido_mm && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 font-bold font-mono">
                Blank: {dev.comprimento_desenvolvido_mm} mm
              </Badge>
            )}
            {dev.comprimento_final_mm && (
              <Badge variant="outline" className="font-mono">
                Comp: {dev.comprimento_final_mm} mm
              </Badge>
            )}
            {chapaVinculada && (
              <Badge className="bg-emerald-600 text-white">
                <Package className="w-3 h-3 mr-1" /> {chapaVinculada.codigo}
              </Badge>
            )}
          </div>

          {/* Alerta blank padrão da tabela */}
          {blankPadrao && dev.comprimento_desenvolvido_mm && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>Tabela Padrão AJL:</strong> Para o perfil <strong>{blankPadrao.perfil}</strong>{" "}
                em e{dev.espessura_mm}mm, o blank padrão é <strong>{blankPadrao.blank} mm</strong>.
                {" "}Calculado (Fator K): <strong>{dev.comprimento_desenvolvido_mm} mm</strong>.
                {Math.abs(blankPadrao.blank - dev.comprimento_desenvolvido_mm) > 3 && (
                  <span className="ml-1 text-amber-900 font-bold">
                    ⚠️ Diferença de {Math.abs(blankPadrao.blank - dev.comprimento_desenvolvido_mm)} mm — confira!
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Tabs de visualização */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
            {[
              { id: "croqui", label: "📐 Desenho 2D" },
              { id: "aproveitamento", label: "📊 Aproveitamento" },
              { id: "tabela", label: "📋 Tabela Blanks" },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAbaVisual(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  abaVisual === tab.id
                    ? "bg-white text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Aba Croqui 2D */}
          {abaVisual === "croqui" && (
            <div className="border border-border rounded-xl overflow-hidden bg-slate-900">
              <CroquiPeca2D
                abas={abas}
                dobras={dobras}
                espessura_mm={parseFloat(dev.espessura_mm) || 1.5}
                nomePeca={dev.nome_peca}
                larguraPlanificada={dev.comprimento_desenvolvido_mm || 100}
                comprimento_mm={parseFloat(dev.comprimento_final_mm) || 3000}
                material={dev.material}
                maquinaNome={isCorte ? dev.maquina_corte : dev.maquina_dobra}
              />
            </div>
          )}

          {/* Aba Aproveitamento */}
          {abaVisual === "aproveitamento" && (
            <div className="border border-border rounded-xl p-4 bg-card">
              <AproveitamentoBlank dev={dev} />
            </div>
          )}

          {/* Aba Tabela de Blanks Padrão */}
          {abaVisual === "tabela" && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
                📋 Tabela de Blanks Padrão — AJL Ferro &amp; Aço
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 font-bold text-slate-700 sticky left-0 bg-slate-100 min-w-[130px]">Perfil</th>
                      {ESP_COLS.map(e => (
                        <th key={e} className="px-3 py-2 text-center font-bold text-slate-600 min-w-[55px]">
                          e{String(e).replace(".", ",")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(TABELA_BLANKS).map(([perfil, blanks], i) => {
                      const nomeUp = (dev.nome_peca || "").toUpperCase();
                      const perfilUp = perfil.toUpperCase().replace("ENRRU.", "").trim();
                      const matchesPerfil = nomeUp.includes(perfilUp) || perfilUp.includes(nomeUp.split(" ")[0]?.replace(/[^0-9X]/g, ""));
                      const espIdx = ESP_COLS.findIndex(e => Math.abs(e - parseFloat(dev.espessura_mm)) < 0.1);
                      return (
                        <tr
                          key={perfil}
                          className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"} ${matchesPerfil ? "ring-2 ring-inset ring-orange-400" : ""}`}
                        >
                          <td className={`px-3 py-2 font-semibold sticky left-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"} ${matchesPerfil ? "text-orange-700 font-black" : "text-slate-800"}`}>
                            {perfil}
                            {matchesPerfil && <span className="ml-1 text-orange-500 text-[10px]">↑ esta peça</span>}
                          </td>
                          {blanks.map((b, j) => (
                            <td
                              key={j}
                              className={`px-3 py-2 text-center font-mono ${
                                matchesPerfil && j === espIdx
                                  ? "bg-orange-500 text-white font-black rounded"
                                  : "text-slate-700"
                              }`}
                            >
                              {b}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Formulário de criação da OP */}
          {!enviado ? (
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Configurar OP para a Máquina</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Máquina Destino *</Label>
                  <Select value={maquina} onValueChange={setMaquina}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar máquina..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="─── Corte ───" disabled>─── Corte ───</SelectItem>
                      {MAQUINAS_CORTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      <SelectItem value="─── Dobra ───" disabled>─── Dobra ───</SelectItem>
                      {MAQUINAS_DOBRA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade de Peças *</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 10"
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    min={1}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nº Pedido</Label>
                  <Input
                    placeholder="Ex: 12345"
                    value={numeroPedido}
                    onChange={e => setNumeroPedido(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cliente</Label>
                  <Input
                    placeholder="Nome do cliente"
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações para o Operador</Label>
                <Textarea
                  placeholder="Ex: Atenção: girar chapa, pré-montar suporte..."
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={2}
                />
              </div>

              {isCorte && dev.maquina_dobra && dev.maquina_dobra !== "PERFILADEIRA" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>
                    Após o corte ser finalizado, o sistema vai <strong>criar automaticamente a OP de dobra</strong> na{" "}
                    <strong>{dev.maquina_dobra}</strong> com o mesmo desenho.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-base font-black text-emerald-800">OP enviada com sucesso!</p>
              <p className="text-sm text-emerald-700">
                O operador da <strong>{maquina}</strong> já pode ver o desenho e os parâmetros de{" "}
                <strong>{dev.nome_peca}</strong> na tela da máquina.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3 gap-2">
          <Button variant="outline" onClick={onClose}>
            {enviado ? "Fechar" : "Cancelar"}
          </Button>
          {!enviado && (
            <Button
              onClick={handleEnviar}
              disabled={loading}
              className="gap-2 bg-orange-500 hover:bg-orange-600 font-bold"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4" /> Enviar para {maquina}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
