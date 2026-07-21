import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Plus, 
  Mail, 
  Settings2, 
  Monitor, 
  ShieldAlert, 
  ArrowLeft, 
  Search, 
  Camera, 
  CheckCircle, 
  Eye, 
  AlertTriangle, 
  LayoutTemplate, 
  Shield, 
  User, 
  Settings,
  Factory,
  Package,
  ShoppingCart,
  Truck,
  DollarSign,
  FileText,
  Sliders,
  CheckSquare,
  Wrench,
  Percent,
  Ban,
  Clock,
  Layers,
  FileCheck,
  Zap,
  Lock,
  Download,
  Activity,
  RotateCcw,
  Sparkles,
  Scissors,
  BookmarkPlus,
  BarChart3,
  LayoutDashboard,
  AppWindow
} from "lucide-react";
import { toast } from "sonner";

const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM", "CORTE DE EPS"];
const MAQUINAS_CD = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa", ""];

function getMaquinasPorSetor(setor) {
  if (setor === "telhas") return MAQUINAS_TELHAS;
  if (setor === "corte_dobra") return MAQUINAS_CD;
  return [...MAQUINAS_TELHAS, ...MAQUINAS_CD];
}

function parseMaquinas(maquina) {
  if (!maquina) return [];
  try {
    const parsed = JSON.parse(maquina);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [maquina];
  }
}

function serializeMaquinas(arr) {
  if (!arr || arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  return JSON.stringify(arr);
}

const ROLES = [
  { value: "super_admin", label: "Super Administrador", desc: "Controle total — gerencia usuários e permissões" },
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema" },
  { value: "encarregado", label: "Encarregado / Líder", desc: "Chefe dos operadores — lança OPs e comanda o barracão" },
  { value: "operador", label: "Operador", desc: "Vê e executa pedidos da sua máquina" },
  { value: "vendedor", label: "Vendedor", desc: "Cadastra e acompanha pedidos comerciais" },
];

const SETORES = [
  { value: "telhas", label: "🏗️ Telhas" },
  { value: "corte_dobra", label: "✂️ Corte e Dobra" },
  { value: "ambos", label: "🏭 Ambos os setores" },
];

const SETOR_COLORS = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  ambos: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
};

const ROLE_COLORS = {
  super_admin: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  admin: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  encarregado: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  operador: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  vendedor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
};

// ----------------------------------------------------
// 50+ REGRAS ODOO-STYLE + SELEÇÃO DE APLICATIVOS VISÍVEIS
// ----------------------------------------------------
export const REGRAS_CATEGORIZADAS = [
  {
    categoriaId: "aplicativos",
    categoriaNome: "0. Aplicativos Visíveis na Tela Inicial (Menu)",
    icon: AppWindow,
    cor: "text-purple-600 font-bold",
    regras: [
      { key: "app_fabrica_telhas", label: "Módulo Fábrica de Telhas", desc: "Exibe o cartão Fábrica de Telhas no menu inicial do usuário.", icon: Factory },
      { key: "app_corte_dobra", label: "Módulo Corte e Dobra", desc: "Exibe o cartão Corte e Dobra no menu inicial do usuário.", icon: Scissors },
      { key: "app_logistica", label: "Módulo Logística & Frota", desc: "Exibe o cartão Logística & Frota no menu inicial do usuário.", icon: Truck },
      { key: "app_consulta_estoque", label: "Módulo Consulta de Estoque", desc: "Exibe o cartão Consulta de Estoque no menu inicial do usuário.", icon: BookmarkPlus },
      { key: "app_painel_vendedor", label: "Módulo Painel do Vendedor", desc: "Exibe o cartão Painel do Vendedor no menu inicial do usuário.", icon: BarChart3 },
      { key: "app_dashboard_ajl", label: "Módulo Dashboard AJL", desc: "Exibe o cartão Dashboard AJL no menu inicial do usuário.", icon: LayoutDashboard },
      { key: "app_gerencia_fabricas", label: "Módulo Gerência de Fábricas", desc: "Exibe o cartão Gerência de Fábricas (OEE) no menu inicial.", icon: Settings },
      { key: "app_control_tower", label: "Módulo Control Tower", desc: "Exibe o cartão Control Tower no menu inicial do usuário.", icon: ShieldAlert },
      { key: "app_gestao_usuarios", label: "Módulo Gestão de Usuários", desc: "Exibe o cartão Gestão de Usuários no menu inicial do usuário.", icon: Users },
    ]
  },
  {
    categoriaId: "producao",
    categoriaNome: "1. Produção & MES",
    icon: Factory,
    cor: "text-blue-500",
    regras: [
      { key: "pular_foto_balanca", label: "Pular Foto da Balança", desc: "Permite finalizar OP usando peso teórico sem foto da balança.", icon: Camera },
      { key: "ignorar_bloqueio_op", label: "Ignorar Bloqueio de OP", desc: "Iniciar Ordens de Produção mesmo se houver divergência ou dependência pendente.", icon: AlertTriangle },
      { key: "remover_sobra_bobina", label: "Registrar Retalho sem Pesagem", desc: "Permite cadastrar sobras/retalhos de bobinas sem pesagem obrigatória.", icon: Layers },
      { key: "alterar_velocidade_linha", label: "Alterar Cadência da Máquina", desc: "Ajustar velocidade nominal e metros/min da linha de produção.", icon: Zap },
      { key: "finalizar_op_parcial", label: "Finalização Parcial de OP", desc: "Finalizar parcialmente uma OP sem necessidade de senha de supervisor.", icon: CheckCircle },
      { key: "override_perda_sucata", label: "Aprovar Perda/Sucata > 3%", desc: "Lançar refugo de aço acima da taxa de tolerância padrão da fábrica.", icon: Percent },
      { key: "ignorar_manutencao_preventiva", label: "Bypass de Alerta de Manutenção", desc: "Permite rodar máquina com alerta de preventiva ou checagem pendente.", icon: Wrench },
      { key: "imprimir_etiqueta_avulsa", label: "Impressão Manual de Etiquetas", desc: "Gerar etiquetas de lote/rastreabilidade fora do fluxo de OP.", icon: FileText },
      { key: "alterar_operador_op", label: "Reatribuir Operador da OP", desc: "Transferir a Ordem de Produção ativa para outro operador em tempo real.", icon: User },
      { key: "reaproveitar_retalho_critico", label: "Usar Retalho sem Laudo QC", desc: "Iniciar corte usando retalho estocado sem inspeção prévia de qualidade.", icon: CheckSquare },
    ]
  },
  {
    categoriaId: "estoque",
    categoriaNome: "2. Estoque & Bobinas",
    icon: Package,
    cor: "text-orange-500",
    regras: [
      { key: "aprovar_reserva_automatica", label: "Reserva Automática de Bobina", desc: "Reservar estoque de bobinas/chapas automaticamente sem validação gerencial.", icon: CheckCircle },
      { key: "movimentar_bobina_bloqueada", label: "Movimentar Bobina Retida", desc: "Transferir bobina que está sob quarentena ou bloqueio de qualidade.", icon: Lock },
      { key: "dar_baixa_manual_materia_prima", label: "Baixa de Matéria-Prima sem QR Code", desc: "Dar baixa em insumo digitando código manualmente sem escaneamento.", icon: Sliders },
      { key: "alterar_espessura_aco", label: "Alterar Corrida/Espessura na OP", desc: "Substituir liga/espessura do aço selecionado durante a produção.", icon: Layers },
      { key: "reclassificar_bobina_b_grade", label: "Reclassificar Bobina B-Grade/Sucata", desc: "Alterar classificação de bobina master para segunda linha ou refugo.", icon: AlertTriangle },
      { key: "ajustar_inventario_manual", label: "Ajuste Manual de Saldo de Estoque", desc: "Realizar acerto direto de quilos e metros no estoque de matéria-prima.", icon: Settings },
      { key: "liberar_insumo_sem_estoque", label: "Uso de Insumos com Saldo Negativo", desc: "Consumir cola/EPS/chapa mesmo se o saldo no ERP estiver zerado.", icon: Ban },
      { key: "receber_bobina_com_divergencia", label: "Receber Carga com Divergência de Peso", desc: "Dar entrada de bobina da usina com divergência superior a 1% da Nota Fiscal.", icon: FileCheck },
      { key: "bloquear_bobina_para_cliente", label: "Cativar Bobina Exclusiva para Cliente", desc: "Travar lote de bobinas master exclusivamente para determinado cliente.", icon: Lock },
      { key: "cancelar_reserva_estoque", label: "Cancelar Reserva de Pedido Ativo", desc: "Liberar matéria-prima reservada para um pedido e alocar em outro.", icon: Ban },
    ]
  },
  {
    categoriaId: "vendas",
    categoriaNome: "3. Vendas & Comercial",
    icon: ShoppingCart,
    cor: "text-green-500",
    regras: [
      { key: "desconto_acima_limite", label: "Conceder Desconto > Teto Misto", desc: "Aplicar descontos acima da alçada do vendedor sem aprovação da diretoria.", icon: Percent },
      { key: "vender_sem_estoque", label: "Vender sem Bobina em Estoque", desc: "Lançar pedido comercial de material sem saldo de matéria-prima garantido.", icon: ShoppingCart },
      { key: "liberar_credito_cliente", label: "Liberar Venda para Cliente Inadimplente", desc: "Aprovar pedido para cliente com títulos vencidos ou restrição financeira.", icon: DollarSign },
      { key: "alterar_tabela_precos", label: "Alterar Tabela de Preços no Orçamento", desc: "Seleção livre da tabela de preços (Promocional/Distribuidor/Atacado).", icon: Sliders },
      { key: "cancelar_pedido_em_producao", label: "Cancelar Pedido em Produção", desc: "Sustar ou alterar pedido de venda que já está sendo cortado na fábrica.", icon: Ban },
      { key: "bloquear_venda_margem_baixa", label: "Permitir Venda com Margem < Custo", desc: "Lançar orçamento com margem de contribuição abaixo do limite mínimo.", icon: Percent },
      { key: "priorizar_fila_producao", label: "Priorizar Fila de Produção", desc: "Mudar a sequência de prioridade do pedido na fila de máquinas da fábrica.", icon: Clock },
      { key: "ver_clientes_outros_vendedores", label: "Ver Carteira de Outros Vendedores", desc: "Acessar e visualizar pedidos e orçamentos de toda a equipe comercial.", icon: Eye },
      { key: "aprovar_bonificacao_amostra", label: "Aprovar Amostra / Bonificação Grátis", desc: "Autorizar emissão de pedido de amostra sem cobrança do cliente.", icon: CheckCircle },
      { key: "gerar_orcamento_condicao_especial", label: "Prazo de Pagamento Especial", desc: "Inserir prazos de faturamento estendidos (ex: 90/120 dias).", icon: Clock },
    ]
  },
  {
    categoriaId: "logistica",
    categoriaNome: "4. Logística & Expedição",
    icon: Truck,
    cor: "text-purple-500",
    regras: [
      { key: "autorizar_carregamento_parcial", label: "Carregamento Parcial de Caminhão", desc: "Liberar saída de veículo com pedido incompleto ou carga dividida.", icon: Truck },
      { key: "liberar_saida_sem_nota", label: "Saída de Carga sem Emissão de NF", desc: "Autorizar saída do caminhão da fábrica com romaneio provisório.", icon: FileText },
      { key: "sobrecarregar_peso_veiculo", label: "Bypass de Peso Máximo do Veículo", desc: "Ignorar alerta de excesso de tonelagem no caminhão da entrega.", icon: AlertTriangle },
      { key: "alterar_rota_entrega", label: "Alterar Ordem de Rotas Logísticas", desc: "Reorganizar a sequência de paradas de entrega do motorista.", icon: Sliders },
      { key: "confirmar_entrega_sem_canhoto", label: "Confirmar Entrega sem Canhoto", desc: "Dar baixa em entrega realizada sem foto/imagem do canhoto assinado.", icon: FileCheck },
      { key: "solicitar_frete_terceiro", label: "Contratar Frete Terceirizado Extra", desc: "Solicitar inclusão de motorista/transportadora terceirizada.", icon: Truck },
      { key: "liberar_devolucao_cliente", label: "Aceitar Devolução de Material no Local", desc: "Autorizar retorno de perfil/telha avariada no caminhão.", icon: ArrowLeft },
      { key: "reimprimir_romaneio_carga", label: "Reimpressão de Romaneio de Carga", desc: "Reimprimir folhas de carregamento e mapas de expedição.", icon: FileText },
      { key: "atribuir_motorista_veiculo", label: "Vincular Placa/Motorista à Carga", desc: "Alterar cadastro do caminhão e motorista alocado no despacho.", icon: User },
      { key: "bloquear_carga_incompleta", label: "Impedir Faturamento de Carga Incompleta", desc: "Travar faturamento se houver item de telha/dobra faltando no lote.", icon: Lock },
    ]
  },
  {
    categoriaId: "financeiro",
    categoriaNome: "5. Financeiro & Custos",
    icon: DollarSign,
    cor: "text-emerald-500",
    regras: [
      { key: "ver_dados_financeiros", label: "Ver Dados Financeiros & Margens", desc: "Exibir custos de matéria-prima, margens de lucro e DRE nas OPs e vendas.", icon: Eye },
      { key: "aprovar_pagamento_fornecedor", label: "Aprovar Contas a Pagar sem Nota Auditada", desc: "Autorizar liberação financeira de pagamento sem auditoria prévia.", icon: DollarSign },
      { key: "emitir_nota_devolucao", label: "Emissão Manual de NF de Devolução", desc: "Emitir notas de entrada/remessa/troca manualmente no ERP.", icon: FileText },
      { key: "estornar_faturamento", label: "Estornar Faturamento de Pedido", desc: "Cancelar faturamento emitido e retornar pedido para fila de produção.", icon: Ban },
      { key: "alterar_dados_bancarios", label: "Alterar Chave Pix / Dados de Pagamento", desc: "Modificar cadastro bancário de clientes e fornecedores no sistema.", icon: Settings },
    ]
  },
  {
    categoriaId: "sistema",
    categoriaNome: "6. Sistema, Qualidade & Layout",
    icon: Shield,
    cor: "text-amber-500",
    regras: [
      { key: "layout_compacto", label: "Layout Compacto Denso", desc: "Forçar exibição densa de tabelas e cartões para otimizar espaço de tela.", icon: LayoutTemplate },
      { key: "alterar_parametros_sistema", label: "Modificar Configurações Globais ERP", desc: "Acessar parâmetros mestres da fábrica e integrações de API.", icon: Settings },
      { key: "exportar_relatorios_excel", label: "Exportar Relatórios Comerciais em Excel", desc: "Permite baixar dados sensíveis de vendas e estoque em planilha.", icon: Download },
      { key: "gerenciar_usuarios_sistema", label: "Acessar Gestão de Usuários", desc: "Conceder acesso à tela de permissões e cadastro de funcionários.", icon: Users },
      { key: "ver_log_auditoria", label: "Visualizar Logs e Trilha de Auditoria", desc: "Consultar histórico de ações, edições e acessos efetuados no ERP.", icon: Activity },
    ]
  }
];

// Flat permissions default
const DEFAULT_PERMISSIONS = {};
REGRAS_CATEGORIZADAS.forEach(cat => {
  cat.regras.forEach(r => {
    DEFAULT_PERMISSIONS[r.key] = false;
  });
});

// ----------------------------------------------------
// GERADOR DE REGRAS PADRÃO POR FUNÇÃO / PAPEL (ROLE TEMPLATES)
// ----------------------------------------------------
export function getDefaultPermissionsForRole(role) {
  const perms = { ...DEFAULT_PERMISSIONS };

  if (role === "super_admin" || role === "admin") {
    // Admins possuem todas as 50+ permissões e todos os aplicativos ativos por padrão
    Object.keys(perms).forEach(k => { perms[k] = true; });
    return perms;
  }

  if (role === "encarregado") {
    // Encarregado vê os apps de produção, logística, estoque e dashboard
    perms.app_fabrica_telhas = true;
    perms.app_corte_dobra = true;
    perms.app_logistica = true;
    perms.app_consulta_estoque = true;
    perms.app_dashboard_ajl = true;

    // Regras operacionais
    perms.ignorar_bloqueio_op = true;
    perms.finalizar_op_parcial = true;
    perms.imprimir_etiqueta_avulsa = true;
    perms.remover_sobra_bobina = true;
    perms.alterar_velocidade_linha = true;
    perms.alterar_operador_op = true;
    perms.pular_foto_balanca = true;
    perms.priorizar_fila_producao = true;
    perms.autorizar_carregamento_parcial = true;
    perms.reaproveitar_retalho_critico = true;
    perms.override_perda_sucata = true;
    perms.layout_compacto = true;
    return perms;
  }

  if (role === "operador") {
    // Operadores veem apps da fábrica
    perms.app_fabrica_telhas = true;
    perms.app_corte_dobra = true;

    // Regras de fábrica
    perms.ignorar_bloqueio_op = true;
    perms.finalizar_op_parcial = true;
    perms.imprimir_etiqueta_avulsa = true;
    perms.remover_sobra_bobina = true;
    perms.alterar_velocidade_linha = true;
    perms.layout_compacto = true;
    return perms;
  }

  if (role === "vendedor") {
    // Vendedores veem comercial e estoque
    perms.app_painel_vendedor = true;
    perms.app_consulta_estoque = true;
    perms.app_dashboard_ajl = true;

    // Regras comerciais
    perms.vender_sem_estoque = true;
    perms.alterar_tabela_precos = true;
    perms.aprovar_bonificacao_amostra = true;
    perms.gerar_orcamento_condicao_especial = true;
    perms.desconto_acima_limite = true;
    return perms;
  }

  return perms;
}

export default function GerenciarUsuarios() {
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [activeTab, setActiveTab] = useState("perfil");
  const [searchTerm, setSearchTerm] = useState("");
  const [regrasSearchTerm, setRegrasSearchTerm] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operador");
  const [inviting, setInviting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: rawUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  // Garantir que todo usuário receba as permissões vinculadas à sua função por padrão se não tiver salvas
  const users = rawUsers.map(u => {
    const hasCustomPerms = u.permissions && Object.keys(u.permissions).length > 0;
    return {
      ...u,
      permissions: hasCustomPerms ? u.permissions : getDefaultPermissionsForRole(u.role)
    };
  });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["users"] }); 
      setEditOpen(false); 
      setEditUser(null); 
      toast.success("Usuário atualizado com sucesso!"); 
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao atualizar usuário.");
    }
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const platformRole = (inviteRole === "admin" || inviteRole === "super_admin") ? "admin" : "user";
      await base44.users.inviteUser(inviteEmail, platformRole);
      toast.success(`Convite enviado para ${inviteEmail}!`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("operador");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error("Erro ao enviar convite: " + e.message);
    }
    setInviting(false);
  };

  const handleUpdateUser = () => {
    if (!editUser) return;
    updateMutation.mutate({ 
      id: editUser.id, 
      data: {
        full_name: editUser.full_name,
        role: editUser.role,
        maquina: serializeMaquinas(editUser.maquinas || []),
        unidade: editUser.unidade || "",
        setor: editUser.setor || "telhas",
        gerencia: editUser.gerencia || false,
        permissions: editUser.permissions || getDefaultPermissionsForRole(editUser.role)
      }
    });
  };

  const toggleMaquina = (m) => {
    setEditUser(u => {
      const maquinas = u.maquinas || [];
      const exists = maquinas.includes(m);
      return { ...u, maquinas: exists ? maquinas.filter(x => x !== m) : [...maquinas, m] };
    });
  };

  const handlePermissionToggle = (permKey) => {
    setEditUser(u => {
      const currentPerms = u.permissions || getDefaultPermissionsForRole(u.role);
      return {
        ...u,
        permissions: {
          ...currentPerms,
          [permKey]: !currentPerms[permKey]
        }
      };
    });
  };

  // Restaurar permissões padrão da função do usuário
  const handleApplyRoleDefaults = () => {
    if (!editUser) return;
    const defaults = getDefaultPermissionsForRole(editUser.role);
    setEditUser(u => ({ ...u, permissions: defaults }));
    toast.success(`Permissões padrão de ${ROLES.find(r => r.value === editUser.role)?.label || editUser.role} aplicadas!`);
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term)
    );
  });

  // Bloqueia acesso se não for admin/super_admin
  if (currentUser && currentUser.role !== "admin" && currentUser.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold">Acesso Restrito</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Apenas administradores podem acessar o gerenciamento de usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Voltar" className="h-9 w-9 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Gerenciar Usuários & Aplicativos Visíveis
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure quais aplicativos aparecem no menu de cada usuário e gerencie 50+ regras operacionais.
            </p>
          </div>
        </div>

        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-sm shrink-0">
          <Plus className="w-4 h-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Roles explicação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r.value).length;
          return (
            <div key={r.value} className={`border rounded-xl p-3 bg-card ${ROLE_COLORS[r.value].replace("text-", "border-").replace("-100", "-200").replace("-700", "-300")}`}>
              <div className="flex items-center justify-between mb-1.5">
                <Badge className={`border text-xs ${ROLE_COLORS[r.value]}`}>{r.label}</Badge>
                <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded bg-muted">
                  {count} {count === 1 ? "usuário" : "usuários"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Barra de Busca e Contador */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground font-medium">
          Mostrando <strong>{filteredUsers.length}</strong> de <strong>{users.length}</strong> usuário(s) cadastrado(s)
        </p>
      </div>

      {/* Lista de usuários */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredUsers.map(u => {
              const perms = u.permissions || getDefaultPermissionsForRole(u.role);
              const userMaquinas = parseMaquinas(u.maquina);
              
              // Contar regras especiais ativas para este usuário
              const totalRegrasAtivas = Object.values(perms).filter(Boolean).length;

              return (
                <div key={u.id} className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <span className="text-primary font-bold text-sm">
                        {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
                    {u.role && (
                      <Badge className={`border text-xs ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </Badge>
                    )}
                    {u.gerencia && (
                      <Badge className="border text-xs bg-amber-100 text-amber-700 border-amber-200">
                        Gerência
                      </Badge>
                    )}
                    {u.setor && (
                      <Badge className={`border text-xs ${SETOR_COLORS[u.setor] || ""}`}>
                        {SETORES.find(s => s.value === u.setor)?.label || u.setor}
                      </Badge>
                    )}
                    {userMaquinas.map(m => (
                      <Badge key={m} variant="outline" className="text-xs gap-1 font-normal bg-background">
                        <Monitor className="w-3 h-3 text-muted-foreground" />
                        {m}
                      </Badge>
                    ))}
                    {u.unidade && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {u.unidade}
                      </Badge>
                    )}

                    {/* Contador de Regras Ativas */}
                    {totalRegrasAtivas > 0 ? (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-purple-500" /> {totalRegrasAtivas} Regra(s) / App(s)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                        Regras Padrão
                      </Badge>
                    )}

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-1 ml-1" 
                      onClick={() => { 
                        setEditUser({ 
                          ...u, 
                          maquinas: userMaquinas,
                          permissions: u.permissions || getDefaultPermissionsForRole(u.role)
                        }); 
                        setActiveTab("perfil");
                        setEditOpen(true); 
                      }}
                    >
                      <Settings2 className="w-4 h-4" />
                      Configurar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Convidar Usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input 
                type="email" 
                placeholder="email@exemplo.com" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              O novo usuário já entrará no sistema com os aplicativos e permissões padrão vinculados à função escolhida!
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Lateral Configurar Usuário (Perfil + Motor de 50+ Regras Categorizadas + Apps Visíveis) */}
      <Sheet open={editOpen} onOpenChange={open => { setEditOpen(open); if(!open) setEditUser(null); }}>
        <SheetContent className="w-[500px] sm:w-[680px] border-border bg-background/95 backdrop-blur-xl overflow-y-auto p-6">
          {editUser && (
            <>
              <SheetHeader className="mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <span className="text-primary font-bold text-lg">
                      {(editUser.full_name || editUser.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{editUser.full_name || editUser.email}</SheetTitle>
                    <SheetDescription className="text-xs flex items-center gap-2 mt-0.5">
                      <span>{editUser.email}</span>
                      <Badge className={`border text-[10px] py-0 ${ROLE_COLORS[editUser.role] || ""}`}>
                        {ROLES.find(r => r.value === editUser.role)?.label || editUser.role}
                      </Badge>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="perfil" className="gap-2">
                    <User className="w-4 h-4" />
                    Perfil & Máquinas
                  </TabsTrigger>
                  <TabsTrigger value="permissoes" className="gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    Aplicativos & Regras (50+)
                  </TabsTrigger>
                </TabsList>

                {/* Aba 1: Perfil & Máquinas */}
                <TabsContent value="perfil" className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="user-name">Nome Completo</Label>
                    <Input 
                      id="user-name"
                      value={editUser.full_name || ""} 
                      onChange={e => setEditUser(u => ({ ...u, full_name: e.target.value }))}
                      placeholder="Nome do colaborador"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Papel *</Label>
                    <Select 
                      value={editUser.role || "operador"} 
                      onValueChange={v => {
                        const newDefaults = getDefaultPermissionsForRole(v);
                        setEditUser(u => ({ 
                          ...u, 
                          role: v,
                          permissions: { ...newDefaults, ...(u.permissions || {}) }
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label} — {r.desc}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Setor</Label>
                    <Select value={editUser.setor || "telhas"} onValueChange={v => setEditUser(u => ({ ...u, setor: v, maquinas: [] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Define em qual setor este usuário trabalha</p>
                  </div>

                  {editUser.role === "operador" && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-primary" />
                        Máquinas Associadas
                      </Label>
                      <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-card/50">
                        {getMaquinasPorSetor(editUser.setor || "telhas").map(m => (
                          <label key={m} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                            <Checkbox
                              checked={(editUser.maquinas || []).includes(m)}
                              onCheckedChange={() => toggleMaquina(m)}
                            />
                            <span className="text-xs">{m}</span>
                          </label>
                        ))}
                      </div>
                      {(editUser.maquinas || []).length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {(editUser.maquinas || []).length} máquina(s) selecionada(s): {(editUser.maquinas || []).join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">O operador verá apenas os pedidos das máquinas selecionadas</p>
                    </div>
                  )}

                  <div className="bg-card/40 rounded-lg p-3 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Acesso Gerencial</p>
                      <p className="text-xs text-muted-foreground">Acesso ao setor gerencial (link externo OEE)</p>
                    </div>
                    <Switch
                      checked={editUser.gerencia || false}
                      onCheckedChange={v => setEditUser(u => ({ ...u, gerencia: v }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Unidade</Label>
                    <Select value={editUser.unidade || "todas"} onValueChange={v => setEditUser(u => ({ ...u, unidade: v === "todas" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        {UNIDADES.filter(u => u).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Aba 2: Aplicativos Visíveis + Motor de 50+ Regras Granulares Odoo-Style por Tópicos */}
                <TabsContent value="permissoes" className="space-y-5">
                  <div className="flex items-center justify-between gap-2 bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                          Template: {ROLES.find(r => r.value === editUser.role)?.label || editUser.role}
                        </p>
                        <p className="text-[11px] text-purple-700 dark:text-purple-300">
                          Aplicativos e regras vinculados à função do usuário.
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleApplyRoleDefaults}
                      className="h-8 text-xs gap-1 border-purple-300 text-purple-800 hover:bg-purple-100 shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar Padrão
                    </Button>
                  </div>

                  {/* Busca de Regras */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Pesquisar aplicativos ou regras..." 
                      value={regrasSearchTerm}
                      onChange={e => setRegrasSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-6">
                    {REGRAS_CATEGORIZADAS.map(cat => {
                      const CatIcon = cat.icon;
                      
                      // Filtrar regras da categoria com base na busca interna
                      const regrasFiltradas = cat.regras.filter(r => 
                        r.label.toLowerCase().includes(regrasSearchTerm.toLowerCase()) ||
                        r.desc.toLowerCase().includes(regrasSearchTerm.toLowerCase())
                      );

                      if (regrasFiltradas.length === 0) return null;

                      return (
                        <div key={cat.categoriaId} className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                            <CatIcon className={`w-4 h-4 ${cat.cor}`} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                              {cat.categoriaNome}
                            </h3>
                            <Badge variant="outline" className="text-[10px] ml-auto font-mono">
                              {regrasFiltradas.length} item(ns)
                            </Badge>
                          </div>

                          <div className="space-y-2.5">
                            {regrasFiltradas.map(regra => {
                              const RegraIcon = regra.icon || Shield;
                              const isChecked = !!editUser.permissions?.[regra.key];

                              return (
                                <div 
                                  key={regra.key} 
                                  className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                                    isChecked 
                                      ? "border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-sm" 
                                      : "border-border/60 bg-card/40 hover:bg-card/70"
                                  }`}
                                >
                                  <div className="space-y-0.5 pr-3">
                                    <Label className="text-xs font-semibold flex items-center gap-2 cursor-pointer" onClick={() => handlePermissionToggle(regra.key)}>
                                      <RegraIcon className={`h-3.5 w-3.5 ${isChecked ? "text-primary font-bold" : "text-muted-foreground"}`} />
                                      {regra.label}
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                      {regra.desc}
                                    </p>
                                  </div>
                                  <Switch 
                                    checked={isChecked}
                                    onCheckedChange={() => handlePermissionToggle(regra.key)}
                                    className="mt-0.5 shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditOpen(false); setEditUser(null); }}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateUser} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}