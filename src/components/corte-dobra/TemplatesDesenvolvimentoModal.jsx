/**
 * TemplatesDesenvolvimentoModal.jsx
 * 
 * Modal para criar desenvolvimentos a partir dos templates padrão da AJL.
 * Tabela de blanks digitalizada da folha impressa da fábrica.
 * Cada linha = perfil + abas + ângulos + blank por espessura.
 * O usuário escolhe o perfil, a espessura e (opcionalmente) o material,
 * e o sistema cria o DesenvolvimentoCD pré-preenchido e aprovado.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, BookOpen, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useFilial } from "@/contexts/FilialContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Tabela completa de blanks padrão AJL ────────────────────────────────────
// Colunas: e1,95 | e2,0 | e2,25 | e2,3 | e2,65 | e2,7 | e3,0
const ESP_COLS = [1.95, 2.0, 2.25, 2.3, 2.65, 2.7, 3.0];
const ESP_LABELS = ["1,95", "2,0", "2,25", "2,3", "2,65", "2,7", "3,0"];

// Cada template: { id, nome, descricao, abas, dobras, blanks[7], maquina_corte, maquina_dobra, largura_mm, comprimento_padrao_mm }
const TEMPLATES = [
  {
    id: "perfil_u_25x50x25",
    nome: "Perfil U 25×50×25",
    categoria: "Perfil U",
    descricao: "Aba 25mm · Alma 50mm · Aba 25mm — 2 dobras 90°",
    abas: [25, 50, 25],
    dobras: [{ angulo: 90, direcao: "cima", raio: 1.5 }, { angulo: 90, direcao: "cima", raio: 1.5 }],
    blanks: [92, 92, 91, 91, 89, 89, 88],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_u_30x68x30",
    nome: "Perfil U 30×68×30",
    categoria: "Perfil U",
    descricao: "Aba 30mm · Alma 68mm · Aba 30mm — 2 dobras 90°",
    abas: [30, 68, 30],
    dobras: [{ angulo: 90, direcao: "cima", raio: 1.5 }, { angulo: 90, direcao: "cima", raio: 1.5 }],
    blanks: [120, 120, 119, 119, 117, 117, 116],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_u_38x75x38",
    nome: "Perfil U 38×75×38",
    categoria: "Perfil U",
    descricao: "Aba 38mm · Alma 75mm · Aba 38mm — 2 dobras 90°",
    abas: [38, 75, 38],
    dobras: [{ angulo: 90, direcao: "cima", raio: 1.5 }, { angulo: 90, direcao: "cima", raio: 1.5 }],
    blanks: [143, 143, 142, 142, 140, 140, 139],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_u_30x92x30",
    nome: "Perfil U 30×92×30",
    categoria: "Perfil U",
    descricao: "Aba 30mm · Alma 92mm · Aba 30mm — 2 dobras 90°",
    abas: [30, 92, 30],
    dobras: [{ angulo: 90, direcao: "cima", raio: 1.5 }, { angulo: 90, direcao: "cima", raio: 1.5 }],
    blanks: [144, 144, 143, 143, 141, 141, 140],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_c_40x100x40",
    nome: "Perfil C 40×100×40",
    categoria: "Perfil C",
    descricao: "Aba 40mm · Alma 100mm · Aba 40mm — 2 dobras 90°",
    abas: [40, 100, 40],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [172, 172, 171, 171, 169, 169, 168],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_c_50x100x50",
    nome: "Perfil C 50×100×50",
    categoria: "Perfil C",
    descricao: "Aba 50mm · Alma 100mm · Aba 50mm — 2 dobras 90°",
    abas: [50, 100, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [192, 192, 191, 191, 189, 189, 188],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_c_50x125x50",
    nome: "Perfil C 50×125×50",
    categoria: "Perfil C",
    descricao: "Aba 50mm · Alma 125mm · Aba 50mm — 2 dobras 90°",
    abas: [50, 125, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [217, 217, 216, 216, 214, 214, 213],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_c_50x150x50",
    nome: "Perfil C 50×150×50",
    categoria: "Perfil C",
    descricao: "Aba 50mm · Alma 150mm · Aba 50mm — 2 dobras 90°",
    abas: [50, 150, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [242, 242, 241, 241, 239, 239, 238],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_c_50x200x50",
    nome: "Perfil C 50×200×50",
    categoria: "Perfil C",
    descricao: "Aba 50mm · Alma 200mm · Aba 50mm — 2 dobras 90°",
    abas: [50, 200, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [292, 292, 291, 291, 289, 289, 288],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_enrru_75x38",
    nome: "75×38 Enrijecido",
    categoria: "Enrijecido",
    descricao: "Perfil com enrijecedor — aba 38mm · alma 75mm",
    abas: [38, 75, 38],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [171, 171, 169, 169, 166, 165, 173],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_enrru_100x40",
    nome: "100×40 Enrijecido",
    categoria: "Enrijecido",
    descricao: "Perfil com enrijecedor — aba 40mm · alma 100mm",
    abas: [40, 100, 40],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [200, 200, 198, 198, 195, 194, 202],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_enrru_100x50",
    nome: "100×50 Enrijecido",
    categoria: "Enrijecido",
    descricao: "Perfil com enrijecedor — aba 50mm · alma 100mm",
    abas: [50, 100, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [220, 220, 218, 218, 215, 214, 222],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_enrru_125x50",
    nome: "125×50 Enrijecido",
    categoria: "Enrijecido",
    descricao: "Perfil com enrijecedor — aba 50mm · alma 125mm",
    abas: [50, 125, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [245, 245, 243, 243, 240, 239, 247],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
  {
    id: "perfil_enrru_150x50",
    nome: "150×50 Enrijecido",
    categoria: "Enrijecido",
    descricao: "Perfil com enrijecedor — aba 50mm · alma 150mm",
    abas: [50, 150, 50],
    dobras: [{ angulo: 90, direcao: "cima", raio: 2 }, { angulo: 90, direcao: "cima", raio: 2 }],
    blanks: [270, 270, 268, 268, 265, 264, 272],
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    largura_mm: 6000,
  },
];

const MATERIAIS = [
  "Aço galvanizado",
  "Aço zincado",
  "Aço pré-pintado",
  "Aço inox",
  "Alumínio",
  "Aço carbono",
];

const CATEGORIAS = ["Todos", ...Array.from(new Set(TEMPLATES.map(t => t.categoria)))];

export default function TemplatesDesenvolvimentoModal({ open, onClose }) {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();

  const [categoria, setCategoria] = useState("Todos");
  const [templateSel, setTemplateSel] = useState(null);
  const [espIdx, setEspIdx] = useState(1); // index em ESP_COLS (default 2.0mm)
  const [material, setMaterial] = useState("Aço galvanizado");
  const [comprimento, setComprimento] = useState("6000");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [cliente, setCliente] = useState("");
  const [criados, setCriados] = useState([]); // ids criados nesta sessão

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DesenvolvimentoCD.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["desenvolvimentos-cd"] });
      queryClient.invalidateQueries({ queryKey: ["desenvolvimentos-cd-ativos"] });
      setCriados(prev => [...prev, created.id]);
      toast.success(`✅ Desenvolvimento "${templateSel?.nome}" criado e aprovado!`);
    },
    onError: (e) => toast.error("Erro ao criar: " + e.message),
  });

  const templatesFiltrados = categoria === "Todos"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.categoria === categoria);

  const handleCriar = () => {
    if (!templateSel) { toast.error("Selecione um perfil."); return; }
    const esp = ESP_COLS[espIdx];
    const blank = templateSel.blanks[espIdx];
    const compNum = parseFloat(comprimento) || 6000;

    // Fator K aproximado por espessura (valores padrão da fábrica)
    const fatorK = esp <= 2.0 ? 0.33 : esp <= 2.5 ? 0.35 : 0.38;

    createMutation.mutate({
      nome_peca: templateSel.nome,
      material,
      espessura_mm: esp,
      espessura_label: `${String(esp).replace(".", ",")} mm`,
      comprimento_desenvolvido_mm: blank,
      comprimento_final_mm: compNum,
      largura_mm: templateSel.largura_mm || 6000,
      abas_json: JSON.stringify(templateSel.abas),
      dobras_json: JSON.stringify(templateSel.dobras),
      fator_k: fatorK,
      maquina_corte: templateSel.maquina_corte,
      maquina_dobra: templateSel.maquina_dobra,
      numero_pedido: numeroPedido || undefined,
      cliente: cliente || undefined,
      status: "aprovado",
      unidade: filialAtiva && filialAtiva !== "todas" ? filialAtiva : "Matriz AJL",
      observacoes_tecnicas: `Template padrão AJL · Blank=${blank}mm · Fator K=${fatorK}`,
    });
  };

  const blankSel = templateSel ? templateSel.blanks[espIdx] : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-orange-500" />
            Templates Padrão — Blanks AJL
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Tabela de blanks padrão da fábrica digitalizada. Selecione o perfil + espessura → desenvolvimento criado e aprovado automaticamente.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtro de categoria */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIAS.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  categoria === cat
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-card text-muted-foreground border-border hover:border-orange-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tabela de perfis */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">📋 Perfis Padrão AJL · Espessura da Chapa (mm)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-slate-700 sticky left-0 bg-slate-100 min-w-[170px]">Perfil</th>
                    {ESP_LABELS.map((e, i) => (
                      <th
                        key={i}
                        className={`px-2 py-2 text-center font-bold min-w-[52px] cursor-pointer transition-colors ${
                          espIdx === i ? "bg-orange-100 text-orange-700 ring-1 ring-orange-400" : "text-slate-600 hover:bg-orange-50"
                        }`}
                        onClick={() => setEspIdx(i)}
                        title={`Selecionar espessura ${e}mm`}
                      >
                        e{e}
                        {espIdx === i && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mx-auto mt-0.5" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {templatesFiltrados.map((t, i) => {
                    const isSelected = templateSel?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setTemplateSel(t)}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400"
                            : i % 2 === 0
                            ? "bg-white hover:bg-orange-50/40"
                            : "bg-slate-50/60 hover:bg-orange-50/40"
                        }`}
                      >
                        <td className={`px-3 py-2.5 sticky left-0 ${isSelected ? "bg-emerald-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                          <div className="flex items-center gap-2">
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                            <div>
                              <p className={`font-bold leading-tight ${isSelected ? "text-emerald-800" : "text-slate-800"}`}>{t.nome}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight">{t.descricao}</p>
                            </div>
                          </div>
                        </td>
                        {t.blanks.map((b, j) => (
                          <td
                            key={j}
                            className={`px-2 py-2.5 text-center font-mono font-semibold transition-colors ${
                              isSelected && j === espIdx
                                ? "bg-orange-500 text-white font-black text-sm"
                                : j === espIdx
                                ? "bg-orange-50 text-orange-700 font-bold"
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
            <div className="bg-slate-50 border-t border-border px-4 py-1.5 text-[10px] text-muted-foreground">
              Clique no cabeçalho da espessura para selecionar · Clique na linha do perfil para selecionar
            </div>
          </div>

          {/* Preview + configuração */}
          {templateSel && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Zap className="w-5 h-5 text-emerald-600" />
                <span className="font-black text-emerald-900 text-base">{templateSel.nome}</span>
                <Badge className="bg-orange-500 text-white font-bold text-sm px-3">
                  e{String(ESP_COLS[espIdx]).replace(".", ",")}mm
                </Badge>
                <Badge className="bg-emerald-600 text-white font-black text-base px-4 py-1">
                  ✂️ Blank: {blankSel} mm
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Material</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comp. da Peça (mm)</Label>
                  <Input
                    value={comprimento}
                    onChange={e => setComprimento(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="6000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nº Pedido (opcional)</Label>
                  <Input
                    value={numeroPedido}
                    onChange={e => setNumeroPedido(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Ex: 12345"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cliente (opcional)</Label>
                  <Input
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Nome do cliente"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-emerald-700">
                <span>Dobras: <strong>{templateSel.dobras.length}×</strong></span>
                <span>·</span>
                <span>Corte: <strong>{templateSel.maquina_corte}</strong></span>
                <span>·</span>
                <span>Dobra: <strong>{templateSel.maquina_dobra}</strong></span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={handleCriar}
                  disabled={createMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2"
                >
                  {createMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                    : <><CheckCircle2 className="w-4 h-4" /> Criar Desenvolvimento Aprovado</>
                  }
                </Button>
                {criados.length > 0 && (
                  <span className="text-xs text-emerald-700 font-semibold">
                    ✅ {criados.length} criado{criados.length > 1 ? "s" : ""} nesta sessão
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Aviso sobre templates criados */}
          {criados.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                {criados.length} desenvolvimento{criados.length > 1 ? "s criados" : " criado"} com status <strong>Aprovado</strong>.
                Já estão disponíveis para os operadores na tela de máquinas.
              </span>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Os blanks são os valores padrão da tabela física da fábrica. Pequenas variações por máquina ou material são normais.
              Após criar, você pode editar o desenvolvimento para ajustar medidas específicas.
            </span>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>
            {criados.length > 0 ? "Fechar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
