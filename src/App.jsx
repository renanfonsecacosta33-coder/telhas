import { lazy, Suspense } from 'react';
import RouteLoading from '@/components/routing/RouteLoading';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import ErrorBoundary from "@/components/ErrorBoundary";
import { FilialProvider } from '@/contexts/FilialContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import OfflineStatusBar from '@/components/offline/OfflineStatusBar';
import SupabaseRealtimeSync from '@/components/SupabaseRealtimeSync';
import AutoRefreshInactivity from '@/components/AutoRefreshInactivity';
import AjlIaCopilot from '@/components/chat/AjlIaCopilot';

// Somente a tela visitada é baixada e preparada. Relatórios, mapas,
// calculadoras e outros setores não bloqueiam a abertura do PCP.
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const AppLayoutCD = lazy(() => import('@/components/layout/CorteDobra/AppLayoutCD'));
const AppLayoutExpedicao = lazy(() => import('@/components/layout/Expedicao/AppLayoutExpedicao'));
const DashboardTelhas = lazy(() => import('@/pages/DashboardTelhas'));
const DashboardCorteDobraCompleto = lazy(() => import('@/pages/DashboardCorteDobraCompleto'));
const Bobinas = lazy(() => import('@/pages/Bobinas'));
const Isopor = lazy(() => import('@/pages/Isopor'));
const Producao = lazy(() => import('@/pages/Producao'));
const Configuracoes = lazy(() => import('@/pages/Configuracoes'));
const GerenciarUsuarios = lazy(() => import('@/pages/GerenciarUsuarios'));
const UsuariosEquipe = lazy(() => import('@/pages/UsuariosEquipe'));
const TP40 = lazy(() => import('@/pages/maquinas/TP40'));
const TP25 = lazy(() => import('@/pages/maquinas/TP25'));
const Ondulada = lazy(() => import('@/pages/maquinas/Ondulada'));
const Colonial = lazy(() => import('@/pages/maquinas/Colonial'));
const Bandeja = lazy(() => import('@/pages/maquinas/Bandeja'));
const Desbobinador = lazy(() => import('@/pages/maquinas/Desbobinador'));
const Cumeeira = lazy(() => import('@/pages/maquinas/Cumeeira'));
const Colagem = lazy(() => import('@/pages/maquinas/Colagem'));
const DashboardProducao = lazy(() => import('@/pages/DashboardProducao'));
const DashboardEstoque = lazy(() => import('@/pages/DashboardEstoque'));
const DashboardTP40 = lazy(() => import('@/pages/maquinas/DashboardTP40'));
const DashboardTP25 = lazy(() => import('@/pages/maquinas/DashboardTP25'));
const DashboardOndulada = lazy(() => import('@/pages/maquinas/DashboardOndulada'));
const DashboardColonial = lazy(() => import('@/pages/maquinas/DashboardColonial'));
const DashboardBandeja = lazy(() => import('@/pages/maquinas/DashboardBandeja'));
const DashboardDesbobinador = lazy(() => import('@/pages/maquinas/DashboardDesbobinador'));
const DashboardCumeeira = lazy(() => import('@/pages/maquinas/DashboardCumeeira'));
const DashboardColagem = lazy(() => import('@/pages/maquinas/DashboardColagem'));
const CalculadoraIsopor = lazy(() => import('@/pages/CalculadoraIsopor'));
const DashboardPerformance = lazy(() => import('@/pages/DashboardPerformance'));
const Cola = lazy(() => import('@/pages/Cola'));
const VendedorEstoque = lazy(() => import('@/pages/VendedorEstoque'));
const VendedorDashboard = lazy(() => import('@/pages/VendedorDashboard'));
const PainelAdministrativo = lazy(() => import('@/pages/PainelAdministrativo'));
const PerformanceOperadores = lazy(() => import('@/pages/PerformanceOperadores'));
const SeletorSetor = lazy(() => import('@/pages/SeletorSetor'));
const ProducaoCD = lazy(() => import('@/pages/corte-dobra/Producao'));
const BobinasCD = lazy(() => import('@/pages/corte-dobra/Bobinas'));
const Chaparia = lazy(() => import('@/pages/corte-dobra/Chaparia'));
const EPI = lazy(() => import('@/pages/corte-dobra/EPI'));
const DesenvolvimentoCD = lazy(() => import('@/pages/corte-dobra/Desenvolvimento'));
const AuditoriaPage = lazy(() => import('@/pages/AuditoriaPage'));
const TimelineCarregamentoPage = lazy(() => import('@/pages/TimelineCarregamentoPage'));
const CatalogoCD = lazy(() => import('@/pages/corte-dobra/Catalogo'));
const CentralPopsPage = lazy(() => import('@/pages/CentralPopsPage'));
const RetalhosCD = lazy(() => import('@/pages/corte-dobra/Retalhos'));
const SlitterPage = lazy(() => import('@/pages/corte-dobra/Slitter'));
const CalculosCD = lazy(() => import('@/pages/corte-dobra/Calculos'));
const Corte3m = lazy(() => import('@/pages/corte-dobra/maquinas/Corte3m'));
const Dobra3m = lazy(() => import('@/pages/corte-dobra/maquinas/Dobra3m'));
const Corte6m = lazy(() => import('@/pages/corte-dobra/maquinas/Corte6m'));
const DobraFundo6m = lazy(() => import('@/pages/corte-dobra/maquinas/DobraFundo6m'));
const DobraInicio6m = lazy(() => import('@/pages/corte-dobra/maquinas/DobraInicio6m'));
const Perfiladeira = lazy(() => import('@/pages/corte-dobra/maquinas/Perfiladeira'));
const Desbobinadeira = lazy(() => import('@/pages/corte-dobra/maquinas/Desbobinadeira'));
const Laser = lazy(() => import('@/pages/corte-dobra/maquinas/Laser'));
const Dobra4m = lazy(() => import('@/pages/corte-dobra/maquinas/Dobra4m'));
const MapaBarracao = lazy(() => import('@/pages/corte-dobra/MapaBarracao'));
const BobinaQR = lazy(() => import('@/pages/BobinaQR'));
const Logistica = lazy(() => import('@/pages/corte-dobra/Logistica'));
const LogisticaStandalone = lazy(() => import('@/pages/Logistica'));
const CentralAlertas = lazy(() => import('@/pages/corte-dobra/CentralAlertas'));
const CentralPCP = lazy(() => import('@/pages/CentralPCP'));
const CalendarioLogisticaPage = lazy(() => import('@/pages/CalendarioLogisticaPage'));
const DashboardExecutivo = lazy(() => import('@/pages/DashboardExecutivo'));
const RelatoriosGerenciais = lazy(() => import('@/pages/RelatoriosGerenciais'));
const DashboardExpedicao = lazy(() => import('@/pages/expedicao/Dashboard'));
const RecebimentoExpedicao = lazy(() => import('@/pages/expedicao/Recebimento'));
const EstoqueExpedicao = lazy(() => import('@/pages/expedicao/Estoque'));
const MapaArmazenagem = lazy(() => import('@/pages/expedicao/MapaArmazenagem'));
const FrisadaPage = lazy(() => import('@/pages/expedicao/Frisada'));
const HistoricoExpedicao = lazy(() => import('@/pages/expedicao/Historico'));
const SaidaMaterial = lazy(() => import('@/pages/expedicao/SaidaMaterial'));
const DevolucoesExpedicao = lazy(() => import('@/pages/expedicao/Devolucoes'));
const ReservasExpedicao = lazy(() => import('@/pages/expedicao/Reservas'));
const LogisticaExpedicao = lazy(() => import('@/pages/expedicao/Logistica'));
const ArquivoRotas = lazy(() => import('@/pages/ArquivoRotas'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shadow-xl shadow-teal-500/10 animate-pulse">
            <span className="text-teal-400 font-black text-xl tracking-wider">AJL</span>
          </div>
          <div className="w-44 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div className="w-full h-full bg-gradient-to-r from-teal-500 via-orange-500 to-blue-500 animate-pulse" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide">Carregando Ecossistema AJL...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <FilialProvider>
    <SupabaseRealtimeSync />
    <AutoRefreshInactivity />
    <Suspense fallback={<RouteLoading />}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardTelhas />} />
        <Route path="/bobinas" element={<Bobinas />} />
        <Route path="/isopor" element={<Isopor />} />
        <Route path="/estoque" element={<Navigate to="/producao" replace />} />
        <Route path="/producao" element={<Producao />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/usuarios-equipe" element={<UsuariosEquipe />} />
        <Route path="/maquina/tp40" element={<TP40 />} />
        <Route path="/maquina/tp25" element={<TP25 />} />
        <Route path="/maquina/ondulada" element={<Ondulada />} />
        <Route path="/maquina/colonial" element={<Colonial />} />
        <Route path="/maquina/bandeja" element={<Bandeja />} />
        <Route path="/maquina/desbobinador" element={<Desbobinador />} />
        <Route path="/maquina/cumeeira" element={<Cumeeira />} />
        <Route path="/maquina/colagem" element={<Colagem />} />
        <Route path="/maquina/corte-eps" element={<Navigate to="/producao" replace />} />
        <Route path="/dashboard-producao" element={<DashboardProducao />} />
        <Route path="/dashboard/tp40" element={<DashboardTP40 />} />
        <Route path="/dashboard/tp25" element={<DashboardTP25 />} />
        <Route path="/dashboard/ondulada" element={<DashboardOndulada />} />
        <Route path="/dashboard/colonial" element={<DashboardColonial />} />
        <Route path="/dashboard/bandeja" element={<DashboardBandeja />} />
        <Route path="/dashboard/desbobinador" element={<DashboardDesbobinador />} />
        <Route path="/dashboard/cumeeira" element={<DashboardCumeeira />} />
        <Route path="/dashboard/colagem" element={<DashboardColagem />} />
        <Route path="/calculadora-isopor" element={<CalculadoraIsopor />} />
        <Route path="/dashboard-performance" element={<DashboardPerformance />} />
        <Route path="/cola" element={<Cola />} />
        <Route path="/mapa-barracao" element={<Navigate to="/producao" replace />} />
        <Route path="/dashboard-telhas" element={<DashboardTelhas />} />
        <Route path="/estoque-dashboard" element={<DashboardEstoque setorInicial="telhas" backUrl="/producao" backLabel="Voltar para Telhas" />} />
        <Route path="/telhas/estoque-dashboard" element={<DashboardEstoque setorInicial="telhas" backUrl="/producao" backLabel="Voltar para Telhas" />} />
        <Route path="/performance-operadores" element={<PerformanceOperadores />} />
        <Route path="/telhas/logistica" element={<Logistica mode="montagem" defaultTab="telhas" />} />
      </Route>
      <Route path="/ranking-operadores" element={<PerformanceOperadores />} />
      <Route path="/painel-estoque" element={<DashboardEstoque setorInicial="todos" backUrl="/setor" backLabel="Voltar ao Início" />} />
      <Route path="/vendedor" element={<VendedorEstoque />} />
      <Route path="/vendedor-dashboard" element={<VendedorDashboard />} />
      <Route path="/painel-admin" element={<PainelAdministrativo />} />
      <Route path="/usuarios" element={<GerenciarUsuarios />} />
      <Route path="/admin/usuarios" element={<GerenciarUsuarios />} />
      <Route path="/corte-dobra/usuarios" element={<GerenciarUsuarios />} />
      <Route path="/logistica" element={<LogisticaStandalone />} />
      <Route path="/logistica-geral" element={<LogisticaStandalone />} />
      <Route path="/pcp" element={<CentralPCP />} />
      <Route path="/setor" element={<SeletorSetor />} />
      <Route path="/bobina-qr/:id" element={<BobinaQR />} />
      <Route path="/calendario-entregas" element={<CalendarioLogisticaPage />} />
      <Route path="/dashboard-executivo" element={<DashboardExecutivo />} />
      <Route path="/relatorios" element={<RelatoriosGerenciais />} />
      <Route path="/auditoria" element={<AuditoriaPage />} />
      <Route path="/timeline-carregamento" element={<TimelineCarregamentoPage />} />
      <Route element={<AppLayoutCD />}>
        <Route path="/corte-dobra" element={<DashboardCorteDobraCompleto />} />
        <Route path="/corte-dobra/producao" element={<ProducaoCD />} />
        <Route path="/corte-dobra/bobinas" element={<BobinasCD />} />
        <Route path="/corte-dobra/estoque-dashboard" element={<DashboardEstoque setorInicial="corte_dobra" backUrl="/corte-dobra/producao" backLabel="Voltar para Corte e Dobra" />} />
        <Route path="/corte-dobra/performance-operadores" element={<PerformanceOperadores />} />
        <Route path="/corte-dobra/chaparia" element={<Chaparia />} />
        <Route path="/corte-dobra/epi" element={<EPI />} />
        <Route path="/corte-dobra/alertas" element={<CentralAlertas />} />
        <Route path="/corte-dobra/desenvolvimento" element={<DesenvolvimentoCD />} />
        <Route path="/corte-dobra/catalogo" element={<CatalogoCD />} />
        <Route path="/corte-dobra/retalhos" element={<RetalhosCD />} />
        <Route path="/corte-dobra/slitter" element={<SlitterPage />} />
        <Route path="/corte-dobra/calculos" element={<CalculosCD />} />
        <Route path="/corte-dobra/maquina/corte-3m" element={<Corte3m />} />
        <Route path="/corte-dobra/maquina/dobra-3m" element={<Dobra3m />} />
        <Route path="/corte-dobra/maquina/corte-6m" element={<Corte6m />} />
        <Route path="/corte-dobra/maquina/dobra-fundo-6m" element={<DobraFundo6m />} />
        <Route path="/corte-dobra/maquina/dobra-inicio-6m" element={<DobraInicio6m />} />
        <Route path="/corte-dobra/maquina/perfiladeira" element={<Perfiladeira />} />
        <Route path="/corte-dobra/maquina/desbobinadeira" element={<Desbobinadeira />} />
        <Route path="/corte-dobra/maquina/desbobinadeira-1" element={<Desbobinadeira maquinaPadrao="DESBOBINADEIRA 01" />} />
        <Route path="/corte-dobra/maquina/desbobinadeira-2" element={<Desbobinadeira maquinaPadrao="DESBOBINADEIRA 02" />} />
        <Route path="/corte-dobra/maquina/laser" element={<Laser />} />
        <Route path="/corte-dobra/maquina/dobra-4m" element={<Dobra4m />} />
        <Route path="/corte-dobra/mapa" element={<MapaBarracao />} />
        <Route path="/corte-dobra/logistica" element={<Logistica mode="despacho" defaultTab="cd" />} />
        <Route path="/corte-dobra/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route element={<AppLayoutExpedicao />}>
        <Route path="/expedicao"             element={<DashboardExpedicao />} />
        <Route path="/expedicao/recebimento" element={<RecebimentoExpedicao />} />
        <Route path="/expedicao/saida"       element={<SaidaMaterial />} />
        <Route path="/expedicao/reservas"    element={<ReservasExpedicao />} />
        <Route path="/expedicao/devolucoes"   element={<DevolucoesExpedicao />} />
        <Route path="/expedicao/estoque"     element={<EstoqueExpedicao />} />
        <Route path="/expedicao/mapa"        element={<MapaArmazenagem />} />
        <Route path="/expedicao/frisada"     element={<FrisadaPage />} />
        <Route path="/expedicao/historico"   element={<HistoricoExpedicao />} />
        <Route path="/expedicao/logistica"   element={<LogisticaExpedicao />} />
      </Route>
      <Route path="/arquivo-rotas" element={<ArquivoRotas />} />
      <Route path="/pops" element={<CentralPopsPage />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    <AjlIaCopilot />
    </FilialProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <OfflineProvider>
          <OfflineStatusBar />
          <Router future={{ v7_startTransition: true }}>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster />
          <PwaInstallPrompt />
        </OfflineProvider>
      </QueryClientProvider>
    </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>)
}

export default App