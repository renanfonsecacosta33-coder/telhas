import React from "react";
import {
  Search,
  X,
  ChevronDown,
  Globe,
  Calendar,
  Zap,
  Clock,
  AlertTriangle,
  Factory,
  CheckCircle2,
  Layers,
  Truck,
  Flame,
  ShoppingBag,
  User,
  Box,
  RotateCw,
  AlertOctagon
} from "lucide-react";
import { formatDataBR } from "@/lib/sla";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

/* ─────────────────────────────────────────────────────────────
   PAINEL LATERAL DE FILTROS DA CENTRAL PCP (rail fixa escura)
   Filiais · Busca · Prazos & SLA · Status & Indicadores · Prioridade · Setor · Vendedor · Estoque MP
   Totalmente otimizado: alto contraste com letras brancas no azul quando ativo!
   ───────────────────────────────────────────────────────────── */

function Sec({ label, icon: Icon, children, badge }) {
  return (
    <div className="py-3.5 border-t border-slate-800 flex flex-col gap-1.5 first:border-t-0 first:pt-0">
      {label && (
        <div className="flex items-center justify-between text-[11px] tracking-[0.08em] uppercase text-slate-400 font-bold mb-0.5 px-1">
          <span className="flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5 text-blue-400" />}
            {label}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function Opt({ on, onClick, title, children, badge, badgeColor, icon: Icon, highlight }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`group flex justify-between items-center w-full px-2.5 py-2 rounded-lg text-left cursor-pointer border transition-all duration-150
        focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400
        ${
          on
            ? "bg-blue-600 border-blue-400 text-white font-bold shadow-md shadow-blue-900/30"
            : highlight
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200 font-medium hover:bg-slate-800 hover:text-white hover:border-slate-700"
            : "border-transparent text-slate-300 font-medium hover:bg-slate-800 hover:text-white hover:border-slate-700"
        }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <Icon
            className={`w-3.5 h-3.5 shrink-0 ${
              on ? "text-white" : highlight ? "text-amber-400" : "text-slate-400 group-hover:text-white"
            }`}
          />
        )}
        <span className={`truncate text-[12.5px] ${on ? "text-white font-bold" : ""}`}>{children}</span>
      </div>
      {badge !== undefined && (
        <span
          className={`tabular-nums text-xs px-2 py-0.5 rounded font-black shrink-0 transition-colors ${
            on
              ? "bg-blue-800 text-white border border-blue-300/40"
              : badgeColor || "bg-slate-800 text-slate-300 border border-slate-700/60"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default function PainelFiltrosPCP({
  // Filiais
  temAcessoGlobalCentrais,
  statsLoja,
  filiaisPcpExibidas,
  lojaSelecionada,
  onMudarLoja,
  // Indicadores
  stats,
  // Busca
  busca,
  setBusca,
  onLimparBusca,
  tiposBusca,
  tipoBusca,
  setTipoBusca,
  modelosRapidos,
  onSelecionarModeloRapido,
  // Status (unificado com indicadores)
  filtros,
  filtro,
  setFiltro,
  // Prioridade / Logística
  filtroPrioridade,
  setFiltroPrioridade,
  statsPrioridade,
  // Setor
  filtroSetor,
  setFiltroSetor,
  countsSetor,
  // Vendedores
  filtroVendedor,
  setFiltroVendedor,
  vendedoresDisponiveis = [],
  // Estoque MP
  filtroMaterial,
  setFiltroMaterial,
  statsMaterial,
  // Prazo / SLA
  filtroDataCampo,
  setFiltroDataCampo,
  filtroDataPreset,
  setFiltroDataPreset,
  onSelectPreset,
  filtroDataInicio,
  setFiltroDataInicio,
  filtroDataFim,
  setFiltroDataFim,
  filtroDataAtivo,
  onLimparFiltroData,
  totalFiltrados
}) {
  const tipoBuscaAtual = tiposBusca.find((t) => t.id === tipoBusca) || tiposBusca[0];
  const IconeTipoBusca = tipoBuscaAtual.icon;

  const PRESETS_DATA = [
    { id: "todas", label: "Todas" },
    { id: "hoje", label: "Hoje" },
    { id: "amanha", label: "Amanhã" },
    { id: "semana", label: "Próx. 7 Dias" }
  ];

  const temAtrasados = (stats?.atrasados || 0) > 0;

  return (
    <aside className="w-full lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60 shrink-0 bg-slate-900 text-slate-300 px-3.5 py-4 lg:overflow-y-auto flex flex-col text-[13px] font-medium no-scrollbar select-none">
      
      {/* 1. FILIAIS */}
      <Sec label="Filiais" icon={Globe}>
        {temAcessoGlobalCentrais && (
          <Opt
            on={lojaSelecionada === "todas"}
            onClick={() => onMudarLoja("todas")}
            badge={statsLoja.todas}
          >
            Todas as Centrais
          </Opt>
        )}
        {filiaisPcpExibidas.map((f) => (
          <Opt
            key={f.id}
            on={lojaSelecionada === f.id}
            onClick={() => onMudarLoja(f.id)}
            badge={statsLoja[f.id] || 0}
          >
            {f.label}
          </Opt>
        ))}
        <p className="text-[10.5px] text-slate-500 px-1 pt-1 leading-tight">
          Filial: <span className="text-slate-300 font-semibold">
            {lojaSelecionada === "todas" ? "Visão Global (Todas)" : lojaSelecionada}
          </span>
        </p>
      </Sec>

      {/* 2. BUSCA */}
      <Sec label="Busca de Pedidos" icon={Search}>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={tipoBuscaAtual.placeholder}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-[12.5px] text-white placeholder:text-slate-500 min-w-0"
          />
          {busca && (
            <button
              type="button"
              onClick={onLimparBusca}
              title="Limpar pesquisa"
              className="p-0.5 text-slate-400 hover:text-white rounded transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Seletor do tipo de busca */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Alternar tipo de busca"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11.5px] text-slate-400 hover:bg-slate-800 hover:text-white transition-colors w-full justify-between border border-slate-800 hover:border-slate-700"
            >
              <span className="flex items-center gap-1.5">
                <IconeTipoBusca className="w-3.5 h-3.5 text-blue-400" />
                {tipoBuscaAtual.label}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1 bg-slate-900 border-slate-800 text-white">
            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Filtrar Busca Por
            </div>
            {tiposBusca.map((t) => {
              const ItemIcon = t.icon;
              const isSelected = tipoBusca === t.id;
              return (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => setTipoBusca(t.id)}
                  className={`flex items-center gap-2 cursor-pointer text-xs rounded-md py-1.5 px-2 font-medium ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <ItemIcon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-blue-400"}`} />
                  <span className="flex-1">{t.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Modelos rápidos */}
        {tipoBusca === "modelo" && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {modelosRapidos.map((mod) => {
              const ativo = busca.toLowerCase().trim() === mod.toLowerCase().trim();
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => onSelecionarModeloRapido(mod)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    ativo
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {mod}
                </button>
              );
            })}
          </div>
        )}
      </Sec>

      {/* 3. PRAZOS & SLA (URGÊNCIA NO TOPO) */}
      <Sec label="Prazos & SLA" icon={Calendar}>
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          {PRESETS_DATA.map((p) => {
            const on = filtroDataPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                className={`px-2 py-1.5 rounded-md text-[11.5px] font-bold transition-all text-center border ${
                  on
                    ? "bg-blue-600 border-blue-400 text-white shadow-sm"
                    : "bg-slate-800/80 border-slate-700/70 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Botão Especial Atrasados (com alerta piscante se houver) */}
        <button
          type="button"
          onClick={() => onSelectPreset("atrasados")}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11.5px] font-bold transition-all border ${
            filtroDataPreset === "atrasados"
              ? "bg-blue-600 border-blue-400 text-white shadow-sm"
              : temAtrasados
              ? "bg-red-500/15 border-red-500/50 text-red-200 hover:bg-red-500/25"
              : "bg-slate-800/80 border-slate-700/70 text-slate-300 hover:bg-slate-700 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AlertOctagon className={`w-3.5 h-3.5 ${temAtrasados ? "text-red-400 animate-pulse" : "text-slate-400"}`} />
            Atrasados
          </span>
          <span
            className={`tabular-nums text-[11px] px-2 py-0.2 rounded font-black ${
              filtroDataPreset === "atrasados"
                ? "bg-blue-800 text-white"
                : temAtrasados
                ? "bg-red-600 text-white animate-pulse"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {stats?.atrasados || 0}
          </span>
        </button>

        {/* Campo alvo: Entrega vs Chegada */}
        <select
          value={filtroDataCampo}
          onChange={(e) => setFiltroDataCampo(e.target.value)}
          className="mt-1 w-full text-[11.5px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 font-medium text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="data_entrega">📅 Prazo Entrega (SLA)</option>
          <option value="data_recebimento">🕒 Chegada no PCP</option>
        </select>

        {/* De / Até */}
        <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
          <span className="shrink-0 text-[10px]">De:</span>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => {
              setFiltroDataPreset("personalizada");
              setFiltroDataInicio(e.target.value);
            }}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500"
          />
          <span className="shrink-0 text-[10px]">Até:</span>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => {
              setFiltroDataPreset("personalizada");
              setFiltroDataFim(e.target.value);
            }}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {filtroDataAtivo && (
          <div className="mt-1.5 flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-950/40 border border-blue-800/60 text-[11px] text-blue-200">
            <span className="font-bold">{totalFiltrados} no período</span>
            <button
              type="button"
              onClick={onLimparFiltroData}
              className="text-[10.5px] font-bold text-blue-400 hover:text-white underline cursor-pointer"
            >
              Limpar
            </button>
          </div>
        )}
      </Sec>

      {/* 4. STATUS & INDICADORES DA FILA (FUSÃO INTERATIVA SEM REPETIÇÃO) */}
      <Sec label="Status & Fila PCP" icon={Layers}>
        <Opt
          on={filtro === "ativos"}
          onClick={() => setFiltro("ativos")}
          icon={Zap}
          badge={stats.ativos}
          title="Todas as ordens ativas na fábrica (não finalizadas)"
        >
          Fila Ativa
        </Opt>

        <Opt
          on={filtro === "pendente_distribuicao"}
          onClick={() => setFiltro("pendente_distribuicao")}
          icon={AlertTriangle}
          badge={stats.pendentes}
          badgeColor={stats.pendentes > 0 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : undefined}
          title="Ordens na mesa do PCP aguardando roteamento e envio às máquinas"
        >
          Pendentes PCP
        </Opt>

        <Opt
          on={filtro === "distribuido"}
          onClick={() => setFiltro("distribuido")}
          icon={Factory}
          badge={stats.distribuidos}
          badgeColor="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
          title="Ordens já distribuídas pelo PCP aguardando execução nas máquinas"
        >
          Distribuídos
        </Opt>

        <Opt
          on={filtro === "produzindo_agora"}
          onClick={() => setFiltro("produzindo_agora")}
          icon={Zap}
          badge={stats.produzindo_agora}
          badgeColor={stats.produzindo_agora > 0 ? "bg-blue-500 text-white font-black animate-pulse" : undefined}
          title="Ordens sendo produzidas neste exato momento pelos operadores"
        >
          ⚡ Em Produção
        </Opt>

        <Opt
          on={filtro === "aguardando_maquina"}
          onClick={() => setFiltro("aguardando_maquina")}
          icon={Clock}
          badge={stats.aguardando_maquina}
          title="Na fila de espera das máquinas"
        >
          ⏳ Na Máquina
        </Opt>

        <Opt
          on={filtro === "concluido"}
          onClick={() => setFiltro("concluido")}
          icon={CheckCircle2}
          badge={stats.concluidos}
          badgeColor="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          title="Ordens já 100% fabricadas e finalizadas"
        >
          Concluídos
        </Opt>

        <Opt
          on={filtro === "entregue"}
          onClick={() => setFiltro("entregue")}
          icon={Truck}
          badge={stats.entregues || 0}
          badgeColor="bg-sky-500/20 text-sky-300 border border-sky-500/40"
          title="Pedidos entregues ao cliente/transportadora e travados na fila de entregues"
        >
          📦 Entregues
        </Opt>

        <Opt
          on={filtro === "todos"}
          onClick={() => setFiltro("todos")}
          icon={Layers}
          badge={stats.total}
          title="Histórico geral completo de todas as OPs"
        >
          Todos os Registros
        </Opt>
      </Sec>

      {/* 5. PRIORIDADE & LOGÍSTICA */}
      <Sec label="Prioridade & Logística" icon={Truck}>
        <Opt
          on={filtroPrioridade === "todos"}
          onClick={() => setFiltroPrioridade("todos")}
          badge={statsPrioridade?.total || 0}
        >
          Todas as Prioridades
        </Opt>

        <Opt
          on={filtroPrioridade === "retira_agora"}
          onClick={() => setFiltroPrioridade("retira_agora")}
          icon={Flame}
          badge={statsPrioridade?.retira || 0}
          badgeColor="bg-red-500/20 text-red-300 border border-red-500/40"
          title="Cliente aguardando na fábrica para retirar agora"
        >
          ⚡🚨 Retira Balcão
        </Opt>

        <Opt
          on={filtroPrioridade === "rota"}
          onClick={() => setFiltroPrioridade("rota")}
          icon={Truck}
          badge={statsPrioridade?.rota || 0}
          badgeColor="bg-blue-500/20 text-blue-300 border border-blue-500/40"
          title="Carga programada para caminhão de rota"
        >
          🚚 Carga de Rota
        </Opt>

        <Opt
          on={filtroPrioridade === "alta"}
          onClick={() => setFiltroPrioridade("alta")}
          icon={AlertTriangle}
          badge={statsPrioridade?.alta || 0}
          badgeColor="bg-amber-500/20 text-amber-300 border border-amber-500/40"
          title="Prioridade Alta autorizada pelo gestor (P1 ou P2)"
        >
          🔥 Prioridade Alta (P1/P2)
        </Opt>
      </Sec>

      {/* 6. SETOR INDUSTRIAL */}
      <Sec label="Setor Industrial" icon={Factory}>
        <Opt
          on={filtroSetor === "todos"}
          onClick={() => setFiltroSetor("todos")}
          badge={countsSetor.total}
        >
          Todos os Setores
        </Opt>

        <Opt
          on={filtroSetor === "telhas"}
          onClick={() => setFiltroSetor("telhas")}
          badge={countsSetor.telhas}
          title="Fábrica de Telhas (Trapezoidal, Ondulada, etc.)"
        >
          🏭 Telhas
        </Opt>

        <Opt
          on={filtroSetor === "corte_dobra"}
          onClick={() => setFiltroSetor("corte_dobra")}
          badge={countsSetor.cd}
          title="Corte & Dobra (Desbobinador, Guilhotina, Dobradeira)"
        >
          ✂️ Corte & Dobra
        </Opt>

        <Opt
          on={filtroSetor === "frisadas"}
          onClick={() => setFiltroSetor("frisadas")}
          badge={countsSetor.frisadas || 0}
          title="Chapas Frisadas"
        >
          🌀 Frisadas
        </Opt>

        <Opt
          on={filtroSetor === "ambos"}
          onClick={() => setFiltroSetor("ambos")}
          badge={countsSetor.ambos}
          title="Pedidos mistos com itens em ambos os barracões"
        >
          🔄 Mistos (Telha + C&D)
        </Opt>
      </Sec>

      {/* 7. VENDEDOR / CARTEIRA */}
      <Sec label="Vendedor / Carteira" icon={User} badge={vendedoresDisponiveis.length > 0 ? `${vendedoresDisponiveis.length}` : undefined}>
        <Opt
          on={filtroVendedor === "todos"}
          onClick={() => setFiltroVendedor("todos")}
        >
          Todos os Vendedores
        </Opt>
        {vendedoresDisponiveis.slice(0, 6).map((v) => (
          <Opt
            key={v.nome}
            on={filtroVendedor === v.nome}
            onClick={() => setFiltroVendedor(v.nome)}
            badge={v.count}
          >
            {v.nome}
          </Opt>
        ))}
        {vendedoresDisponiveis.length > 6 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full text-left px-2.5 py-1.5 text-[11px] text-blue-400 hover:text-white flex items-center justify-between font-bold"
              >
                <span>Ver mais vendedores ({vendedoresDisponiveis.length - 6})...</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-60 overflow-y-auto bg-slate-900 border-slate-800 text-white">
              {vendedoresDisponiveis.slice(6).map((v) => (
                <DropdownMenuItem
                  key={v.nome}
                  onClick={() => setFiltroVendedor(v.nome)}
                  className={`flex items-center justify-between cursor-pointer text-xs py-1.5 px-2 ${
                    filtroVendedor === v.nome ? "bg-blue-600 text-white font-bold" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate">{v.nome}</span>
                  <span className="text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded bg-slate-800">
                    {v.count}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Sec>

      {/* 8. ESTOQUE DE MATÉRIA-PRIMA */}
      <Sec label="Estoque Matéria-Prima" icon={Box}>
        <Opt
          on={filtroMaterial === "todos"}
          onClick={() => setFiltroMaterial("todos")}
        >
          Todas as Matérias-Primas
        </Opt>

        <Opt
          on={filtroMaterial === "com_material"}
          onClick={() => setFiltroMaterial("com_material")}
          badge={statsMaterial.comMaterial}
          badgeColor="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          title="Matéria-prima em estoque (bobina ou chapa OK)"
        >
          🟢 Com Material
        </Opt>

        <Opt
          on={filtroMaterial === "sem_material"}
          onClick={() => setFiltroMaterial("sem_material")}
          badge={statsMaterial.semMaterial}
          badgeColor="bg-red-500/20 text-red-300 border border-red-500/40"
          title="Sem matéria-prima suficiente em estoque"
        >
          🔴 Sem Material
        </Opt>
      </Sec>

    </aside>
  );
}
