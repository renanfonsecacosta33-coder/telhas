import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Settings, GripVertical, Pencil, Trash2, Eye, EyeOff, Ruler, Camera, Scale, ShieldCheck, ScanLine, Users, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ToleranciaEspessuraManager from "@/components/admin/ToleranciaEspessuraManager";
import { useRegrasProducao, setRegraProducao } from "@/lib/regrasProducao";

const ICONES_DISPONIVEIS = [
  "Package", "Droplets", "Wrench", "Layers", "Box", "ShoppingCart",
  "Truck", "BarChart", "FileText", "Tag", "Archive", "Zap"
];

const emptyForm = { nome: "", icone: "Package", path: "", cor: "#3b82f6", ativa: true };

export default function Configuracoes() {
  const regras = useRegrasProducao();
  const [activeTab, setActiveTab] = useState("regras");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => base44.entities.Categoria.list("ordem"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Categoria.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categorias"] }); setDialogOpen(false); toast.success("Categoria criada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Categoria.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categorias"] }); setDialogOpen(false); toast.success("Categoria atualizada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Categoria.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categorias"] }); toast.success("Categoria removida!"); },
  });

  const toggleAtiva = (cat) => {
    updateMutation.mutate({ id: cat.id, data: { ...cat, ativa: !cat.ativa } });
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    const data = { ...form, ordem: editItem ? editItem.ordem : categorias.length + 1 };
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const openNew = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (cat) => { setEditItem(cat); setForm({ nome: cat.nome, icone: cat.icone || "Package", path: cat.path, cor: cat.cor || "#3b82f6", ativa: cat.ativa !== false }); setDialogOpen(true); };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Configurações Gerais das Fábricas
          </h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros operacionais de Telhas, Corte & Dobra e comportamento dos terminais de produção.
          </p>
        </div>
        {activeTab === "categorias" && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("regras")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "regras"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Regras de Produção & Fábrica
        </button>

        <button
          onClick={() => setActiveTab("tolerancias")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "tolerancias"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Ruler className="w-4 h-4" />
          Tolerâncias Odoo
        </button>

        <button
          onClick={() => setActiveTab("categorias")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "categorias"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <GripVertical className="w-4 h-4" />
          Categorias do Menu
        </button>
      </div>

      {/* Tab 1: Regras da Fábrica */}
      {activeTab === "regras" && (
        <div className="space-y-6">
          {/* Card 1: Validação de Etiquetas & IA */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Etiquetas & Reconhecimento por IA</h2>
                  <p className="text-xs text-muted-foreground">
                    Controle de validação visual de matéria-prima (Bobinas e Chapas) nas máquinas.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-background">Telhas & Corte e Dobra</Badge>
            </div>

            <div className="divide-y divide-border">
              {/* Regra principal solicitada pelo usuário: Pular Foto da Etiqueta */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">Permitir ao operador pular a foto da etiqueta</span>
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0">
                        Atalho Rápido
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Quando ativado, os operadores têm acesso imediato ao botão <strong>"⚡ Pular Foto da Etiqueta"</strong> nos diálogos das máquinas (Telhas, Guilhotinas e Desbobinadeiras), iniciando a produção sem travar a linha se a câmera falhar ou a etiqueta estiver ilegível.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={regras.permitirPularFotoEtiqueta !== false}
                  onCheckedChange={(v) => {
                    setRegraProducao("permitirPularFotoEtiqueta", v);
                    toast.success(v ? "Opção de pular foto da etiqueta ativada!" : "Opção de pular foto da etiqueta desativada!");
                  }}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>

              {/* Exigir Validação de Bobina */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-foreground">Exigir validação da etiqueta da bobina</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Obriga o operador a fotografar a etiqueta da bobina antes de liberar o botão de início de OP em Perfiladeiras de Telhas e Desbobinadeiras de Corte e Dobra.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(regras.exigirEtiquetaBobina)}
                  onCheckedChange={(v) => {
                    setRegraProducao("exigirEtiquetaBobina", v);
                    toast.success(v ? "Validação de bobina agora é obrigatória." : "Validação de bobina agora é opcional.");
                  }}
                />
              </div>

              {/* Exigir Validação de Chapa */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-foreground">Exigir validação da etiqueta de chapa (Guilhotinas C&D)</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Solicita foto da etiqueta do pacote de chapas antes de iniciar o corte na Guilhotina de 3m ou 6m.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(regras.exigirEtiquetaChapa)}
                  onCheckedChange={(v) => {
                    setRegraProducao("exigirEtiquetaChapa", v);
                    toast.success(v ? "Validação de chapa agora é obrigatória." : "Validação de chapa agora é opcional.");
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Balança e Pesagens */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Balança, Pesagens e Retalhos</h2>
                  <p className="text-xs text-muted-foreground">
                    Regras para apontamento de peso real e fotos do visor da balança.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-background">Pesagens</Badge>
            </div>

            <div className="divide-y divide-border">
              {/* Permitir pular foto da balanca */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-foreground">Permitir confirmação sem foto da balança</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Quando ativado, os operadores podem salvar pesos teóricos ou conferidos no visor sem a exigência de upload de foto da balança.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={regras.permitirPularFotoBalanca !== false}
                  onCheckedChange={(v) => {
                    setRegraProducao("permitirPularFotoBalanca", v);
                    toast.success("Regra de foto da balança atualizada!");
                  }}
                />
              </div>

              {/* Exigir foto pesagem */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-foreground">Exigir foto da pesagem de sobras e retalhos</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Obriga registrar foto da balança ao devolver bobina de volta ao estoque ou cadastrar retalho de chapa gerado.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(regras.exigirFotoPesagem)}
                  onCheckedChange={(v) => {
                    setRegraProducao("exigirFotoPesagem", v);
                    toast.success("Regra de foto de pesagem atualizada!");
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Operadores & Segurança */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Equipe, Operadores & PCP</h2>
                  <p className="text-xs text-muted-foreground">
                    Obrigatoriedade de apontamento de mão de obra e proteções de fila.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-background">Geral</Badge>
            </div>

            <div className="divide-y divide-border">
              {/* Exigir operador */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-foreground">Exigir seleção de operador(es) ao iniciar OP</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Quando ativado, a máquina não inicia sem que pelo menos um operador ativo seja selecionado no terminal.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(regras.exigirOperadorInicio)}
                  onCheckedChange={(v) => {
                    setRegraProducao("exigirOperadorInicio", v);
                    toast.success("Regra de operador ao iniciar atualizada!");
                  }}
                />
              </div>

              {/* Permitir iniciar sem material */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-foreground">Permitir iniciar OP com saldo/material pendente</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Permite que os operadores iniciem a produção mesmo se o sistema apontar divergência ou estoque não baixado previamente.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(regras.permitirIniciarSemMaterial)}
                  onCheckedChange={(v) => {
                    setRegraProducao("permitirIniciarSemMaterial", v);
                    toast.success("Regra de bloqueio de estoque atualizada!");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Tolerancias Odoo */}
      {activeTab === "tolerancias" && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Trava de Segurança Odoo — Tolerâncias de Espessura</h2>
              <p className="text-xs text-muted-foreground">
                Configuração de desvio aceitável (mm) entre a bobina consumida e a OP do Odoo.
              </p>
            </div>
          </div>
          <ToleranciaEspessuraManager />
        </div>
      )}

      {/* Tab 3: Categorias do Menu */}
      {activeTab === "categorias" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-muted/40">
              <h2 className="text-base font-semibold">Categorias do Menu Lateral</h2>
              <p className="text-xs text-muted-foreground">Ative, desative ou crie categorias no menu lateral de Telhas</p>
            </div>

            {isLoading ? (
              <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
            ) : categorias.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma categoria criada ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">As rotas fixas (Bobinas, Isopor, Outros Produtos) sempre aparecem.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {categorias.map(cat => (
                  <div key={cat.id} className="px-4 py-3 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.cor + "20" }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{cat.nome}</p>
                      <p className="text-xs text-muted-foreground">/{cat.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={cat.ativa !== false} onCheckedChange={() => toggleAtiva(cat)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Como funciona o menu
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Crie categorias customizadas que aparecem no menu lateral de Telhas</li>
              <li>Defina o caminho (path) para a URL da categoria (ex: <code>cola</code> → /cola)</li>
              <li>Ative ou desative sem perder os dados cadastrados</li>
              <li>As categorias criadas aqui aparecem como páginas de Estoque Geral filtradas</li>
            </ul>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={() => setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome da Categoria *</Label>
              <Input placeholder="Ex: Cola, Parafusos, Acessórios..." value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Caminho (URL) *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/</span>
                <Input placeholder="Ex: cola, parafusos..." value={form.path} onChange={e => set("path", e.target.value.toLowerCase().replace(/\s/g, "-"))} />
              </div>
              <p className="text-xs text-muted-foreground">Só letras minúsculas e hífens</p>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.cor} onChange={e => set("cor", e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={form.cor} onChange={e => set("cor", e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.ativa} onCheckedChange={v => set("ativa", v)} />
              <Label>Ativa (visível no menu)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome || !form.path}>{editItem ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}