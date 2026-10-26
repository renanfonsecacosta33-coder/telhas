import React from "react";
import { Search, X, ChevronDown, Globe, Calendar } from "lucide-react";
import { formatDataBR } from "@/lib/sla";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

/* ─────────────────────────────────────────────────────────────
   PAINEL LATERAL DE FILTROS DA CENTRAL PCP (rail fixa escura)
   Filiais · Indicadores · Busca · Status · Setor · Estoque MP · Prazo/SLA
   Toda a lógica (estado e handlers) permanece na página CentralPCP.
   ───────────────────────────────────────────────────────────── */

function Sec({ label, children }) {
  return (
    <div className="py-4 border-t border-slate-800 flex flex-col gap-1.5 first:border-t-0 first:pt-0">
      {label && (
        <div className="text-[11px] tracking-[0.08em] uppercase text-slate-500 font-semibold mb-1">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function Opt({ on, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex justify-between items-center w-full px-2.5 py-[7px] rounded-lg text-left cursor-pointer border-0 bg-transparent transition-colors duration-150
        focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500
        ${on
          ? "bg-emerald-500 text-emerald-950 font-bold hover:bg-emerald-500 active:bg-emerald-600"
          : "text-slate-300 font-medium hover:bg-slate-800 hover:text-white active:bg-slate-700"}`}
    >
      {children}
    </button>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 px-0.5">
      <span className="text-slate-400">{label}</span>
      <strong className={`text-[22px] font-bold tabular-nums ${tone === "bad" ? "text-red-400" : tone === "ok" ? "text-emerald-400" : "text-white"}`}>
        {value}
      </strong>
    </div>
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
  // Status
  filtros,
  filtro,
  setFiltro,
  // Setor
  filtroSetor,
  setFiltroSetor,
  countsSetor,
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
    { id: "semana", label: "Próx. 7 Dias" },
    { id: "atrasados", label: "Atrasados" }
  ];

  return (
    <aside className="w-full lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60 shrink-0 bg-slate-900 text-slate-300 px-4 py-5 lg:overflow-y-auto flex flex-col text-[13px] font-medium no-scrollbar">
      {/* Filiais */}
      <Sec label="Filiais">
        {temAcessoGlobalCentrais && (
          <Opt on={lojaSelecionada === "todas"} onClick={() => onMudarLoja("todas")}>
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Todas as Centrais</span>
            <b className="tabular-nums">{statsLoja.todas}</b>
          </Opt>
        )}
        {filiaisPcpExibidas.map((f) => (
          <Opt key={f.id} on={lojaSelecionada === f.id} onClick={() => onMudarLoja(f.id)}>
            <span>{f.label}</span>
            <b className="tabular-nums">{statsLoja[f.id] || 0}</b>
          </Opt>
        ))}
        <p className="text-[11px] text-slate-500 px-2.5 pt-1.5">
          Exibindo Fila de: <span className="text-slate-300 font-semibold">
            {lojaSelecionada === "todas" ? "Visão Global (Todas as Fábricas)" : `Fábrica: ${lojaSelecionada}`}
          </span>
        </p>
      </Sec>

      {/* Indicadores */}
      <Sec label="Indicadores">
        <Kpi label="Fila Ativa" value={stats.ativos} />
        <Kpi label="Pendentes" value={stats.pendentes} />
        <Kpi label="Distribuídos" value={stats.distribuidos} />
        <Kpi label="Concluídos" value={stats.concluidos} tone="ok" />
        <Kpi label="Atrasados" value={stats.atrasados} tone="bad" />
      </Sec>

      {/* Busca */}
      <Sec label="Busca">
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 focus-within:border-emerald-500 transition-colors">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={tipoBuscaAtual.placeholder}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-slate-100 placeholder:text-slate-500 min-w-0"
          />
          {busca && (
            <button
              type="button"
              onClick={onLimparBusca}
              title="Limpar pesquisa"
              className="p-0.5 text-slate-500 hover:text-white rounded transition-colors shrink-0"
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
              title="Alternar tipo de filtro"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-slate-400 hover:bg-slate-800 hover:text-white transition-colors w-full justify-between"
            >
              <span className="flex items-center gap-1.5">
                <IconeTipoBusca className="w-3.5 h-3.5" />
                {tipoBuscaAtual.label}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1">
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
                      ? "bg-emerald-500 text-white font-bold hover:bg-emerald-600 focus:bg-emerald-600 focus:text-white"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <ItemIcon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-400"}`} />
                  <span className="flex-1">{t.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Modelos rápidos (apenas na busca por modelo) */}
        {tipoBusca === "modelo" && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {modelosRapidos.map((mod) => {
              const ativo = busca.toLowerCase().trim() === mod.toLowerCase().trim();
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => onSelecionarModeloRapido(mod)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                    ativo
                      ? "bg-emerald-500 text-emerald-950"
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

      {/* Status */}
      <Sec label="Status">
        {filtros.map((f) => (
          <Opt key={f.id} on={filtro === f.id} onClick={() => setFiltro(f.id)}>
            <span>{f.label}</span>
            <b className="tabular-nums">{f.count}</b>
          </Opt>
        ))}
      </Sec>

      {/* Setor */}
      <Sec label="Setor">
        <Opt on={filtroSetor === "todos"} onClick={() => setFiltroSetor("todos")}>
          <span>Todos</span>
          <b className="tabular-nums">{countsSetor.total}</b>
        </Opt>
        <Opt on={filtroSetor === "telhas"} onClick={() => setFiltroSetor("telhas")} title="Somente pedidos e ordens da Fábrica de Telhas">
          <span>Telhas</span>
          <b className="tabular-nums">{countsSetor.telhas}</b>
        </Opt>
        <Opt on={filtroSetor === "corte_dobra"} onClick={() => setFiltroSetor("corte_dobra")} title="Somente pedidos e ordens de Corte & Dobra">
          <span>Corte & Dobra</span>
          <b className="tabular-nums">{countsSetor.cd}</b>
        </Opt>
        <Opt on={filtroSetor === "ambos"} onClick={() => setFiltroSetor("ambos")} title="Pedidos com itens em Ambos os barracões (Telhas + C&D)">
          <span>Os 2 (Ambos)</span>
          <b className="tabular-nums">{countsSetor.ambos}</b>
        </Opt>
      </Sec>

      {/* Estoque MP */}
      <Sec label="Estoque MP">
        <Opt on={filtroMaterial === "todos"} onClick={() => setFiltroMaterial("todos")}>
          <span>Todas as OPs</span>
        </Opt>
        <Opt on={filtroMaterial === "com_material"} onClick={() => setFiltroMaterial("com_material")} title="Ordens de Fabricação com matéria-prima em estoque (bobinas ou chapas disponíveis)">
          <span>Com Material</span>
          <b className="tabular-nums">{statsMaterial.comMaterial}</b>
        </Opt>
        <Opt on={filtroMaterial === "sem_material"} onClick={() => setFiltroMaterial("sem_material")} title="Ordens de Fabricação sem matéria-prima suficiente em estoque">
          <span>Sem Material</span>
          <b className="tabular-nums">{statsMaterial.semMaterial}</b>
        </Opt>
      </Sec>

      {/* Prazo / SLA */}
      <Sec label="Prazo / SLA">
        {PRESETS_DATA.map((p) => (
          <Opt key={p.id} on={filtroDataPreset === p.id} onClick={() => onSelectPreset(p.id)}>
            <span>{p.label}</span>
          </Opt>
        ))}

        {/* Campo alvo: Entrega vs Chegada */}
        <select
          value={filtroDataCampo}
          onChange={(e) => setFiltroDataCampo(e.target.value)}
          className="mt-1 w-full text-[12px] bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="data_entrega">Prazo de Entrega (SLA)</option>
          <option value="data_recebimento">Chegada no PCP</option>
        </select>

        {/* De / Até */}
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
          <span className="shrink-0">De:</span>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => { setFiltroDataPreset("personalizada"); setFiltroDataInicio(e.target.value); }}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500"
          />
          <span className="shrink-0">Até:</span>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => { setFiltroDataPreset("personalizada"); setFiltroDataFim(e.target.value); }}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {filtroDataAtivo && (
          <div className="mt-1.5 flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-slate-800/70 border border-slate-700">
            <span className="flex items-start gap-1.5 text-[11px] text-slate-300">
              <Calendar className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
              <span>
                {filtroDataPreset === "hoje" && "Hoje"}
                {filtroDataPreset === "amanha" && "Amanhã"}
                {filtroDataPreset === "semana" && "Próximos 7 dias"}
                {filtroDataPreset === "atrasados" && "Pedidos atrasados (vencidos)"}
                {filtroDataPreset === "personalizada" && (
                  filtroDataInicio && filtroDataFim && filtroDataInicio !== filtroDataFim
                    ? `${formatDataBR(filtroDataInicio)} até ${formatDataBR(filtroDataFim)}`
                    : formatDataBR(filtroDataInicio || filtroDataFim)
                )}
                {filtroDataPreset !== "hoje" && filtroDataPreset !== "amanha" && filtroDataPreset !== "semana" && filtroDataPreset !== "atrasados" && filtroDataPreset !== "personalizada" && "Personalizado"}
              </span>
            </span>
            <span className="text-[11px] font-bold text-white">{totalFiltrados} OFs encontradas</span>
            <button
              type="button"
              onClick={onLimparFiltroData}
              className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 underline text-left"
            >
              Remover filtro
            </button>
          </div>
        )}
      </Sec>
    </aside>
  );
}