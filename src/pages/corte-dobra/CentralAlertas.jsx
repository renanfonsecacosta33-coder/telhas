import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Bell, Plus, Play, Volume2, Trash2, Edit3, UserCheck, Search, Lock, ShieldCheck, Mail, PhoneCall, Check } from "lucide-react";
import { toast } from "sonner";

const EVENTO_LABELS = {
  estoque_baixo: "Estoque Crítico (KG)",
  pedido_pronto: "Pedido Concluído",
  reserva_vencida: "Reserva Expirada (48h)",
  maquina_parada: "Máquina Inativa",
  nova_op_prioritaria: "Nova OP Prioritária",
  atraso_producao: "Atraso na Fila de Produção",
  refugo_alto: "Desperdício/Refugo Alto",
  novo_usuario: "Novo Usuário no Sistema",
};

const SOUNDS = [
  { value: "nenhum", label: "Sem Som" },
  { value: "sirene.mp3", label: "🚨 Sirene Industrial" },
  { value: "caixa_registradora.mp3", label: "💰 Caixa Registradora" },
  { value: "ding.mp3", label: "🔔 Bipe / Notificação" },
  { value: "buzina.mp3", label: "📯 Buzina / Alerta Curto" },
  { value: "alarme_industrial.mp3", label: "💥 Alarme Industrial Contínuo" },
  { value: "sucesso.mp3", label: "✨ Sucesso / Conclusão" },
];

const playSound = (soundFile) => {
  if (!soundFile || soundFile === "nenhum") return;
  const soundUrls = {
    "sirene.mp3": "https://assets.mixkit.co/active_storage/sfx/951/951-84.wav",
    "caixa_registradora.mp3": "https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav",
    "ding.mp3": "https://assets.mixkit.co/active_storage/sfx/911/911-84.wav",
    "buzina.mp3": "https://assets.mixkit.co/active_storage/sfx/2756/2756-84.wav",
    "alarme_industrial.mp3": "https://assets.mixkit.co/active_storage/sfx/1006/1006-84.wav",
    "sucesso.mp3": "https://assets.mixkit.co/active_storage/sfx/1435/1435-84.wav",
  };
  const url = soundUrls[soundFile];
  if (url) {
    const audio = new Audio(url);
    audio.play().catch(err => console.log("Erro ao reproduzir som:", err));
  }
};

export default function CentralAlertas() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [searchUser, setSearchUser] = useState("");

  // Diálogos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [evento, setEvento] = useState("estoque_baixo");
  const [limiteKg, setLimiteKg] = useState(1000);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [phoneFields, setPhoneFields] = useState([""]);
  const [som, setSom] = useState("nenhum");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Queries
  const { data: regras = [], isLoading: isLoadingRegras } = useQuery({
    queryKey: ["alerta-regras"],
    queryFn: () => base44.entities.AlertaRegra.list(),
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users-alertas-hub"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AlertaRegra.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerta-regras"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Nova regra de alerta criada!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AlertaRegra.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerta-regras"] });
      setDialogOpen(false);
      setEditItem(null);
      resetForm();
      toast.success("Regra de alerta atualizada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AlertaRegra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerta-regras"] });
      toast.success("Regra de alerta excluída!");
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: ({ id, permitido }) => base44.entities.User.update(id, { permitido_central_alertas: permitido }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-alertas-hub"] });
      toast.success("Permissão de usuário atualizada!");
    },
  });

  const resetForm = () => {
    setNome("");
    setEvento("estoque_baixo");
    setLimiteKg(1000);
    setSelectedEmails([]);
    setPhoneFields([""]);
    setSom("nenhum");
    setAtivo(true);
  };

  const handleOpenEdit = (regra) => {
    setEditItem(regra);
    setNome(regra.nome || "");
    setEvento(regra.evento || "estoque_baixo");
    setLimiteKg(regra.limite_kg ?? 1000);
    
    // Parse emails de string separada por virgula para array
    const emailsArray = regra.destinatarios_email 
      ? regra.destinatarios_email.split(",").map(e => e.trim()).filter(Boolean) 
      : [];
    setSelectedEmails(emailsArray);

    // Parse telefones de string separada por virgula para array
    const phonesArray = regra.destinatarios_whatsapp 
      ? regra.destinatarios_whatsapp.split(",").map(p => p.trim()).filter(Boolean) 
      : [""];
    setPhoneFields(phonesArray.length > 0 ? phonesArray : [""]);

    setSom(regra.som || "nenhum");
    setAtivo(regra.ativo ?? true);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!nome.trim()) {
      toast.error("Por favor, digite o nome do alerta.");
      return;
    }

    const filteredPhones = phoneFields.map(p => p.trim()).filter(Boolean);

    const payload = {
      nome: nome.trim(),
      evento,
      limite_kg: Number(limiteKg) || 0,
      destinatarios_email: selectedEmails.join(", "),
      destinatarios_whatsapp: filteredPhones.join(", "),
      som,
      ativo,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleAtivo = (regra) => {
    updateMutation.mutate({
      id: regra.id,
      data: { ativo: !regra.ativo },
    });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-slate-50">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isSuperAdmin = currentUser.role === "super_admin" || currentUser.email === "renanfonsecacosta33@gmail.com";
  const hasAccess = isSuperAdmin || currentUser.role === "admin" || currentUser.permitido_central_alertas === true;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 p-6 text-center">
        <Lock className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Negado</h2>
        <p className="text-slate-600 max-w-md">
          Você não tem permissão para acessar a Central de Alertas e Automações. Solicite o acesso ao proprietário do sistema.
        </p>
      </div>
    );
  }

  // Filtragem de usuários para concessão de acesso ao Hub
  const filteredUsers = users.filter(u => {
    if (u.id === currentUser.id) return false;
    const q = searchUser.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Alertas e Automações</h1>
            <p className="text-sm text-slate-500">Configure bipes, sirenes, e-mails e contatos de WhatsApp de forma dinâmica.</p>
          </div>
        </div>
        <Button onClick={() => { setEditItem(null); resetForm(); setDialogOpen(true); }} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </div>

      {/* Regras List */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-bold text-slate-800">Regras Ativas de Automação</h2>
        </div>
        {isLoadingRegras ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : regras.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">Nenhuma regra de alerta cadastrada. Crie uma nova acima!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-border">
                  <th className="text-left px-4 py-3">Nome da Regra</th>
                  <th className="text-left px-4 py-3">Gatilho (Evento)</th>
                  <th className="text-left px-4 py-3">E-mails Destinatários</th>
                  <th className="text-left px-4 py-3">WhatsApp Destinatários</th>
                  <th className="text-center px-4 py-3">Som de Alerta</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {regras.map((regra) => (
                  <tr key={regra.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{regra.nome}</td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-800 font-medium px-2 py-0.5 rounded border border-slate-200">
                        {EVENTO_LABELS[regra.evento] || regra.evento}
                        {regra.evento === "estoque_baixo" && ` (${regra.limite_kg?.toLocaleString("pt-BR")} kg)`}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={regra.destinatarios_email}>
                      {regra.destinatarios_email ? (
                        <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-blue-500" /> {regra.destinatarios_email}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={regra.destinatarios_whatsapp}>
                      {regra.destinatarios_whatsapp ? (
                        <span className="inline-flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5 text-green-600" /> {regra.destinatarios_whatsapp}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          regra.som === "nenhum" 
                            ? "bg-slate-100 text-slate-600 border-slate-200" 
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                          {SOUNDS.find(s => s.value === regra.som)?.label || regra.som}
                        </span>
                        {regra.som !== "nenhum" && (
                          <button 
                            onClick={() => playSound(regra.som)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title="Tocar som de teste"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <Switch 
                        checked={regra.ativo} 
                        onCheckedChange={() => handleToggleAtivo(regra)} 
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(regra)} className="p-2 text-slate-600 hover:text-blue-600">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm("Excluir esta regra de alerta permanentemente?")) {
                          deleteMutation.mutate(regra.id);
                        }
                      }} className="p-2 text-slate-600 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Access Permissions Section (Restrito ao Super Admin / Proprietário) */}
      {isSuperAdmin && (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Permissões de Acesso ao Hub (Exclusivo Proprietário)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Selecione quais usuários podem ver e modificar este painel administrativo de alertas.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input 
                placeholder="Buscar usuário..." 
                className="pl-8 text-xs h-8"
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
              />
            </div>
          </div>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">Nenhum outro usuário encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filteredUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 border border-border rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 pr-3">
                    <p className="font-semibold text-slate-800 text-xs truncate">{u.full_name || u.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize bg-white">{u.role || "operador"}</Badge>
                      <span className="text-[9px] text-slate-400 uppercase font-medium">{u.setor || "telhas"}</span>
                      {u.email === "renanfonsecacosta33@gmail.com" && <Badge className="bg-blue-600 text-[8px] text-white">Dono</Badge>}
                    </div>
                  </div>
                  <Switch 
                    disabled={u.email === "renanfonsecacosta33@gmail.com"}
                    checked={u.email === "renanfonsecacosta33@gmail.com" ? true : !!u.permitido_central_alertas}
                    onCheckedChange={(checked) => toggleUserMutation.mutate({ id: u.id, permitido: checked })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Regra Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editItem ? "✏️ Editar Regra de Alerta" : "➕ Nova Regra de Alerta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold">Nome do Alerta</Label>
              <Input 
                placeholder="Ex: Estoque Mínimo Bobina Galvanizada" 
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Evento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">Gatilho (Evento)</Label>
                <Select value={evento} onValueChange={setEvento}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Escolha um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENTO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">Som de Alerta</Label>
                <Select value={som} onValueChange={setSom}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Escolha um som" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUNDS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Condição de limite para estoque_baixo */}
            {evento === "estoque_baixo" && (
              <div className="space-y-1.5 bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                <Label className="text-blue-900 font-semibold">Limite Crítico de Estoque (KG)</Label>
                <Input 
                  type="number" 
                  value={limiteKg}
                  onChange={e => setLimiteKg(e.target.value)}
                  placeholder="Ex: 1000"
                  className="h-8 bg-white border-blue-200 text-blue-950"
                />
                <p className="text-[10px] text-blue-700">Gera notificação se o peso disponível de qualquer cor cair abaixo desse limite.</p>
              </div>
            )}

            {/* Destinatários E-mail Checklist dos Usuários Logados */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold">Escolher E-mails Destinatários (Usuários Cadastrados)</Label>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-slate-50/30">
                {users.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic p-1">Nenhum usuário cadastrado encontrado.</p>
                ) : (
                  users.map(u => {
                    if (!u.email) return null;
                    const isChecked = selectedEmails.includes(u.email);
                    return (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100/60 p-1.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmails([...selectedEmails, u.email]);
                            } else {
                              setSelectedEmails(selectedEmails.filter(email => email !== u.email));
                            }
                          }}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{u.full_name || u.email}</p>
                          <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                        </div>
                        {isChecked && <Check className="w-3 h-3 text-blue-600" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Destinatários WhatsApp com Botões + e Lixeira */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 font-semibold">WhatsApp Destinatários</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="xs" 
                  onClick={() => setPhoneFields([...phoneFields, ""])}
                  className="h-6 px-2 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50 gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Telefone
                </Button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {phoneFields.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input 
                      placeholder="Ex: +5541999999999" 
                      value={phone}
                      onChange={(e) => {
                        const newFields = [...phoneFields];
                        newFields[idx] = e.target.value;
                        setPhoneFields(newFields);
                      }}
                      className="h-8 flex-1"
                    />
                    {phoneFields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setPhoneFields(phoneFields.filter((_, i) => i !== idx))}
                        className="p-1.5 h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Remover telefone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-400">Use DDI + DDD + número (ex: +5541999999999). Não use vírgulas.</p>
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Label className="text-slate-700 font-semibold">Habilitar Alerta?</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9">Cancelar</Button>
            <Button onClick={handleSave} className="h-9 bg-blue-600 hover:bg-blue-700">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
