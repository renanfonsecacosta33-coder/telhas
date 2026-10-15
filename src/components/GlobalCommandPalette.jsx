import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Factory, 
  Scissors, 
  Truck,
  Inbox,
  BookmarkPlus, 
  BarChart3, 
  LayoutDashboard, 
  Settings, 
  ShieldAlert, 
  Users,
  FileText,
  Package,
  Command,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
  Play,
  RotateCw
} from "lucide-react";
import ModalRastreamentoPedido from "@/components/ModalRastreamentoPedido";

export default function GlobalCommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);

  // Estados de busca em tempo real
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [pedidosResult, setPedidosResult] = useState([]);
  const [bobinasResult, setBobinasResult] = useState([]);
  const [cargasResult, setCargasResult] = useState([]);

  // Estado do Modal de Rastreamento 360°
  const [rastreioPedidoNumero, setRastreioPedidoNumero] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isRole = (roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAppPermitted = (appKey) => {
    if (!user) return true;
    if (user.role === "admin" || user.role === "super_admin") return true;
    if (user.permissions && typeof user.permissions[appKey] === "boolean") {
      return user.permissions[appKey];
    }
    return true;
  };

  const modulosSistema = [
    { id: "mod_telhas", title: "Barracão Telhas & Perfis", category: "Navegação / Módulos", icon: Factory, path: "/", roles: ["super_admin", "admin", "encarregado", "operador"], appKey: "app_fabrica_telhas" },
    { id: "mod_cd", title: "Barracão Corte & Dobra", category: "Navegação / Módulos", icon: Scissors, path: "/corte-dobra", roles: ["super_admin", "admin", "encarregado", "operador"], appKey: "app_corte_dobra" },
    { id: "mod_cd_perf", title: "Perfiladeiras (C&D)", category: "Navegação / Máquinas", icon: Factory, path: "/corte-dobra/perfiladeira", roles: ["super_admin", "admin", "encarregado", "operador"] },
    { id: "mod_cd_corte3", title: "Guilhotina Corte 3M", category: "Navegação / Máquinas", icon: Scissors, path: "/corte-dobra/corte-3m", roles: ["super_admin", "admin", "encarregado", "operador"] },
    { id: "mod_cd_corte6", title: "Guilhotina Corte 6M", category: "Navegação / Máquinas", icon: Scissors, path: "/corte-dobra/corte-6m", roles: ["super_admin", "admin", "encarregado", "operador"] },
    { id: "mod_cd_desb", title: "Desbobinadeiras (C&D)", category: "Navegação / Máquinas", icon: Factory, path: "/corte-dobra/desbobinadeira", roles: ["super_admin", "admin", "encarregado", "operador"] },
    { id: "mod_logistica", title: "Expedição & Logística", category: "Navegação / Módulos", icon: Truck, path: "/expedicao", roles: ["super_admin", "admin", "encarregado"], appKey: "app_logistica" },
    { id: "mod_pcp", title: "Central PCP (Fila Geral)", category: "Navegação / Módulos", icon: Inbox, path: "/pcp", roles: ["super_admin", "admin", "encarregado"], appKey: "app_central_pcp" },
    { id: "mod_estoque", title: "Estoque de Bobinas & Chapas", category: "Navegação / Estoque", icon: BookmarkPlus, path: "/corte-dobra/bobinas", roles: ["super_admin", "admin", "encarregado", "vendedor"], appKey: "app_consulta_estoque" },
    { id: "mod_vendas", title: "Painel de Vendas / Vendedor", category: "Navegação / Módulos", icon: BarChart3, path: "/vendedor-dashboard", roles: ["super_admin", "admin", "vendedor"], appKey: "app_painel_vendedor" },
    { id: "mod_usuarios", title: "Gestão de Usuários & Permissões", category: "Administração", icon: Users, path: "/usuarios", roles: ["super_admin", "admin"], appKey: "app_gestao_usuarios" },
    { id: "mod_admin", title: "Painel Administrativo", category: "Administração", icon: ShieldAlert, path: "/painel-admin", roles: ["super_admin", "admin"], appKey: "app_control_tower" },
  ];

  // Busca Reativa no Base44 ao digitar (debounced)
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setPedidosResult([]);
      setBobinasResult([]);
      setCargasResult([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    const timer = setTimeout(async () => {
      try {
        const termoSemHash = q.replace(/^#/, "");
        const termoUpper = q.toUpperCase();

        // 1. Busca Pedidos Odoo / PCP
        const pOdoo = await base44.entities.PedidoOdoo.filter({}, "-created_date", 250).catch(() => []);
        // 2. Busca OPs de Telhas
        const pTelhas = await base44.entities.Pedido.filter({}, "-created_date", 250).catch(() => []);
        // 3. Busca OPs de Corte & Dobra
        const pCD = await base44.entities.OrdemMaquinaCD.filter({}, "-created_date", 250).catch(() => []);
        // 4. Busca Bobinas
        const pBobinas = await base44.entities.Bobina.filter({}, "-created_date", 150).catch(() => []);
        // 5. Busca Cargas
        const pCargas = await base44.entities.Carga.filter({}, "-created_date", 80).catch(() => []);

        // Mapeamento e Agrupamento de Pedidos por Número
        const mapaPedidos = new Map();

        // Insere Pedidos Odoo
        if (Array.isArray(pOdoo)) {
          pOdoo.forEach(p => {
            const num = String(p.numero_pedido || "").replace(/^#/, "").trim();
            if (!num) return;
            const matchNum = num.toLowerCase().includes(termoSemHash.toLowerCase());
            const matchCli = (p.cliente_nome || "").toLowerCase().includes(q.toLowerCase());
            const matchVend = (p.vendedor_nome || "").toLowerCase().includes(q.toLowerCase());
            const matchOC = (p.numero_oc || "").toLowerCase().includes(termoSemHash.toLowerCase());

            if (matchNum || matchCli || matchVend || matchOC) {
              mapaPedidos.set(num, {
                numero: num,
                cliente: p.cliente_nome || "Cliente não informado",
                vendedor: p.vendedor_nome || "",
                origem: "PCP / Odoo",
                statusGeral: p.status_pcp === "concluido" ? "Concluído PCP" : (p.status_pcp === "em_producao" ? "Em Produção" : "Fila PCP"),
                dataEntrega: p.data_entrega || "",
                itens: []
              });
            }
          });
        }

        // Incorpora Ordens de Telhas
        if (Array.isArray(pTelhas)) {
          pTelhas.forEach(o => {
            const num = String(o.numero_pedido || "").replace(/^#/, "").trim();
            if (!num) return;
            const matchNum = num.toLowerCase().includes(termoSemHash.toLowerCase());
            const matchCli = (o.cliente || "").toLowerCase().includes(q.toLowerCase());
            const matchVend = (o.vendedor || "").toLowerCase().includes(q.toLowerCase());
            const matchProd = (o.produto || "").toLowerCase().includes(q.toLowerCase());

            if (matchNum || matchCli || matchVend || matchProd) {
              const existente = mapaPedidos.get(num) || {
                numero: num,
                cliente: o.cliente || "Cliente não informado",
                vendedor: o.vendedor || "",
                origem: "Fábrica Telhas",
                statusGeral: o.status,
                itens: []
              };
              existente.itens.push({
                maquina: o.maquina,
                produto: `${o.produto || "Telha"} ${o.modelo || ""}`,
                status: o.status,
                setor: "Telhas"
              });
              mapaPedidos.set(num, existente);
            }
          });
        }

        // Incorpora Ordens de Corte & Dobra
        if (Array.isArray(pCD)) {
          pCD.forEach(o => {
            const num = String(o.numero_pedido || "").replace(/^#/, "").trim();
            if (!num) return;
            const matchNum = num.toLowerCase().includes(termoSemHash.toLowerCase());
            const matchCli = (o.cliente || "").toLowerCase().includes(q.toLowerCase());
            const matchVend = (o.vendedor || "").toLowerCase().includes(q.toLowerCase());
            const matchPeca = (o.tipo_peca || "").toLowerCase().includes(q.toLowerCase());

            if (matchNum || matchCli || matchVend || matchPeca) {
              const existente = mapaPedidos.get(num) || {
                numero: num,
                cliente: o.cliente || "Cliente não informado",
                vendedor: o.vendedor || "",
                origem: "Corte & Dobra",
                statusGeral: o.status,
                itens: []
              };
              existente.itens.push({
                maquina: o.maquina,
                produto: o.tipo_peca || "Perfil/Chapa",
                status: o.status,
                setor: "C&D"
              });
              mapaPedidos.set(num, existente);
            }
          });
        }

        // Filtro de Bobinas
        const bobinasFiltradas = Array.isArray(pBobinas) ? pBobinas.filter(b => {
          const cod = String(b.codigo || "").toUpperCase();
          const qual = String(b.qualidade || b.cor || "").toUpperCase();
          return cod.includes(termoUpper) || qual.includes(termoUpper);
        }).slice(0, 5) : [];

        // Filtro de Cargas
        const cargasFiltradas = Array.isArray(pCargas) ? pCargas.filter(c => {
          const num = String(c.numero_carga || c.id || "").toLowerCase();
          const mot = String(c.motorista || "").toLowerCase();
          const plac = String(c.placa || "").toLowerCase();
          return num.includes(q.toLowerCase()) || mot.includes(q.toLowerCase()) || plac.includes(q.toLowerCase());
        }).slice(0, 4) : [];

        setPedidosResult(Array.from(mapaPedidos.values()).slice(0, 8));
        setBobinasResult(bobinasFiltradas);
        setCargasResult(cargasFiltradas);
      } catch (err) {
        console.warn("[GlobalCommandPalette] Erro na busca inteligente:", err);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Filtro de Módulos
  const filteredModulos = useMemo(() => {
    return modulosSistema.filter(cmd => {
      if (cmd.roles && !isRole(cmd.roles)) return false;
      if (cmd.appKey && !isAppPermitted(cmd.appKey)) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
      );
    });
  }, [query, user]);

  const handleSelectModulo = (cmd) => {
    onOpenChange(false);
    setQuery("");
    if (cmd.path) {
      navigate(cmd.path);
    }
  };

  const handleAbrirRastreamento = (numero) => {
    setRastreioPedidoNumero(numero);
  };

  // Se o usuário digitou diretamente um número puro de pedido e não veio nada ainda, oferece o botão direto de rastreio
  const numeroPuro = query.trim().replace(/^#/, "");
  const ehNumeroValido = /^[0-9]{2,}$/.test(numeroPuro);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[94vw] sm:max-w-3xl p-0 gap-0 overflow-hidden border-border bg-slate-900 text-white shadow-2xl rounded-2xl">
          {/* Header da Barra de Busca com Efeito Glow */}
          <div className="flex items-center px-3.5 sm:px-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
            <Search className="w-5 h-5 text-primary shrink-0 mr-3" />
            <Input 
              autoFocus
              placeholder="Buscar Nº Pedido (#1573), Cliente, Bobina (BOB-7023) ou Menus..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="h-14 sm:h-16 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 font-medium"
            />
            {loadingSearch && (
              <RotateCw className="w-4 h-4 text-primary animate-spin mr-2 shrink-0" />
            )}
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 font-mono">
              <Command className="w-3 h-3" /> K
            </div>
          </div>

          <div className="max-h-[65vh] sm:max-h-[460px] overflow-y-auto p-3 space-y-4">
            {/* ATALHO DIRETO: Rastrear Pedido Digitado */}
            {ehNumeroValido && (
              <div 
                onClick={() => handleAbrirRastreamento(numeroPuro)}
                className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-primary/20 via-orange-500/15 to-primary/10 border border-primary/40 hover:border-primary cursor-pointer transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shrink-0 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">Rastrear Pedido #{numeroPuro}</span>
                      <Badge className="bg-primary text-black font-bold text-[10px]">Rastreamento 360°</Badge>
                    </div>
                    <p className="text-xs text-slate-300">
                      Ver exatamente onde este pedido está (PCP, Máquinas, Operador ou Expedição)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary font-bold shrink-0">
                  <span>Ver Rastreio</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )}

            {/* SEÇÃO 1: PEDIDOS ENCONTRADOS */}
            {pedidosResult.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Pedidos de Venda & Produção ({pedidosResult.length})
                  </span>
                  <span className="text-[10px] text-slate-500">Clique para Rastreamento 360°</span>
                </div>
                <div className="grid gap-1.5">
                  {pedidosResult.map(ped => {
                    const temEmProducao = ped.itens.some(i => i.status === "em_producao");
                    const todosProntos = ped.itens.length > 0 && ped.itens.every(i => i.status === "finalizado");

                    return (
                      <div
                        key={ped.numero}
                        onClick={() => handleAbrirRastreamento(ped.numero)}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-primary/50 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                            todosProntos 
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                              : temEmProducao 
                              ? "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse" 
                              : "bg-slate-700 text-slate-200 border-slate-600"
                          }`}>
                            #{ped.numero}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                                {ped.cliente}
                              </span>
                              {todosProntos ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px] gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> 100% Produzido
                                </Badge>
                              ) : temEmProducao ? (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40 text-[9px] gap-1">
                                  <Play className="w-2.5 h-2.5" /> Em Máquina
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 border-slate-700 text-[9px]">
                                  {ped.statusGeral || "Fila PCP"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                              {ped.vendedor && <span>Vendedor: {ped.vendedor}</span>}
                              {ped.itens.length > 0 && (
                                <span className="text-slate-500">
                                  · {ped.itens.map(i => i.maquina).filter(Boolean).slice(0, 2).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-primary font-semibold hidden sm:inline group-hover:underline">
                            Rastrear
                          </span>
                          <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SEÇÃO 2: BOBINAS ENCONTRADAS */}
            {bobinasResult.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-orange-400" />
                  Bobinas em Estoque ({bobinasResult.length})
                </div>
                <div className="grid gap-1.5">
                  {bobinasResult.map(bob => (
                    <div
                      key={bob.id}
                      onClick={() => {
                        onOpenChange(false);
                        navigate("/corte-dobra/bobinas");
                      }}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 text-xs">
                          <span className="font-bold text-white block">
                            [{bob.codigo || "—"}] {bob.qualidade || bob.cor || "Bobina Aço"} · {bob.espessura || bob.espessura_mm || ""}mm
                          </span>
                          <span className="text-slate-400">
                            Peso: {bob.peso_atual_kg || bob.peso_kg || 0} kg · {bob.unidade || "Matriz"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-orange-400 font-medium">Ver Bobina →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEÇÃO 3: CARGAS & LOGÍSTICA */}
            {cargasResult.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-teal-400" />
                  Expedição & Cargas ({cargasResult.length})
                </div>
                <div className="grid gap-1.5">
                  {cargasResult.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onOpenChange(false);
                        navigate("/expedicao");
                      }}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0 text-xs">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-white block">
                            Carga #{c.numero_carga || c.id} · Motorista: {c.motorista || "Não informado"}
                          </span>
                          <span className="text-slate-400">
                            Placa: {c.placa || "—"} · Status: {c.status || "Em carregamento"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-teal-400 font-medium">Ver Carga →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEÇÃO 4: MENUS E MÓDULOS DO SISTEMA */}
            {filteredModulos.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                  Módulos & Máquinas do ERP
                </div>
                <div className="grid gap-1">
                  {filteredModulos.map(cmd => {
                    const CmdIcon = cmd.icon;
                    return (
                      <div
                        key={cmd.id}
                        onClick={() => handleSelectModulo(cmd)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/20 transition-colors border border-slate-700/70 shrink-0">
                            <CmdIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                              {cmd.title}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {cmd.category}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Estado Vazio se nada for encontrado */}
            {query.length >= 2 && !loadingSearch && pedidosResult.length === 0 && bobinasResult.length === 0 && cargasResult.length === 0 && filteredModulos.length === 0 && (
              <div className="p-8 text-center text-xs sm:text-sm text-slate-500">
                Nenhum resultado encontrado para "{query}". Tente o número do pedido, nome do cliente ou código de bobina.
              </div>
            )}
          </div>

          {/* Footer Informativo */}
          <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              💡 Digite o número do pedido para rastrear sua máquina e operador
            </span>
            <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">
              Busca Inteligente AJL
            </Badge>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Rastreamento 360° do Pedido */}
      {rastreioPedidoNumero && (
        <ModalRastreamentoPedido
          numeroPedido={rastreioPedidoNumero}
          open={Boolean(rastreioPedidoNumero)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setRastreioPedidoNumero(null);
          }}
        />
      )}
    </>
  );
}