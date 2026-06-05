import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Bobinas from '@/pages/Bobinas';
import Isopor from '@/pages/Isopor';
import Estoque from '@/pages/Estoque';
import Producao from '@/pages/Producao';
import Configuracoes from '@/pages/Configuracoes';
import GerenciarUsuarios from '@/pages/GerenciarUsuarios';
import TP40 from '@/pages/maquinas/TP40';
import TP25 from '@/pages/maquinas/TP25';
import Ondulada from '@/pages/maquinas/Ondulada';
import Colonial from '@/pages/maquinas/Colonial';
import Bandeja from '@/pages/maquinas/Bandeja';
import Desbobinador from '@/pages/maquinas/Desbobinador';
import Cumeeira from '@/pages/maquinas/Cumeeira';
import Colagem from '@/pages/maquinas/Colagem';
import DashboardProducao from '@/pages/DashboardProducao';
import DashboardTP40 from '@/pages/maquinas/DashboardTP40';
import DashboardTP25 from '@/pages/maquinas/DashboardTP25';
import DashboardOndulada from '@/pages/maquinas/DashboardOndulada';
import DashboardColonial from '@/pages/maquinas/DashboardColonial';
import DashboardBandeja from '@/pages/maquinas/DashboardBandeja';
import DashboardDesbobinador from '@/pages/maquinas/DashboardDesbobinador';
import DashboardCumeeira from '@/pages/maquinas/DashboardCumeeira';
import DashboardColagem from '@/pages/maquinas/DashboardColagem';
import CalculadoraIsopor from '@/pages/CalculadoraIsopor';
import DashboardPerformance from '@/pages/DashboardPerformance';
import Cola from '@/pages/Cola';
import VendedorEstoque from '@/pages/VendedorEstoque';
import SeletorSetor from '@/pages/SeletorSetor';
import AppLayoutCD from '@/components/layout/CorteDobra/AppLayoutCD';
import DashboardCD from '@/pages/corte-dobra/Dashboard';
import ProducaoCD from '@/pages/corte-dobra/Producao';
import BobinasCD from '@/pages/corte-dobra/Bobinas';
import Chaparia from '@/pages/corte-dobra/Chaparia';
import EPI from '@/pages/corte-dobra/EPI';
import UsuariosCD from '@/pages/corte-dobra/Usuarios';
import DesenvolvimentoCD from '@/pages/corte-dobra/Desenvolvimento';
import CatalogoCD from '@/pages/corte-dobra/Catalogo';
import RetalhosCD from '@/pages/corte-dobra/Retalhos';
import CalculosCD from '@/pages/corte-dobra/Calculos';
import Corte3m from '@/pages/corte-dobra/maquinas/Corte3m';
import Dobra3m from '@/pages/corte-dobra/maquinas/Dobra3m';
import Corte6m from '@/pages/corte-dobra/maquinas/Corte6m';
import DobraFundo6m from '@/pages/corte-dobra/maquinas/DobraFundo6m';
import DobraInicio6m from '@/pages/corte-dobra/maquinas/DobraInicio6m';
import Perfiladeira from '@/pages/corte-dobra/maquinas/Perfiladeira';
import MapaBarracao from '@/pages/corte-dobra/MapaBarracao';
import MapaBarracaoTelhas from '@/pages/MapaBarracaoTelhas';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">A</span>
          </div>
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
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
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bobinas" element={<Bobinas />} />
        <Route path="/isopor" element={<Isopor />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/producao" element={<Producao />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/usuarios" element={<GerenciarUsuarios />} />
        <Route path="/maquina/tp40" element={<TP40 />} />
        <Route path="/maquina/tp25" element={<TP25 />} />
        <Route path="/maquina/ondulada" element={<Ondulada />} />
        <Route path="/maquina/colonial" element={<Colonial />} />
        <Route path="/maquina/bandeja" element={<Bandeja />} />
        <Route path="/maquina/desbobinador" element={<Desbobinador />} />
        <Route path="/maquina/cumeeira" element={<Cumeeira />} />
        <Route path="/maquina/colagem" element={<Colagem />} />
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
        <Route path="/mapa-barracao" element={<MapaBarracaoTelhas />} />
      </Route>
      <Route path="/vendedor" element={<VendedorEstoque />} />
      <Route path="/setor" element={<SeletorSetor />} />
      <Route element={<AppLayoutCD />}>
        <Route path="/corte-dobra" element={<DashboardCD />} />
        <Route path="/corte-dobra/producao" element={<ProducaoCD />} />
        <Route path="/corte-dobra/bobinas" element={<BobinasCD />} />
        <Route path="/corte-dobra/chaparia" element={<Chaparia />} />
        <Route path="/corte-dobra/epi" element={<EPI />} />
        <Route path="/corte-dobra/usuarios" element={<UsuariosCD />} />
        <Route path="/corte-dobra/desenvolvimento" element={<DesenvolvimentoCD />} />
        <Route path="/corte-dobra/catalogo" element={<CatalogoCD />} />
        <Route path="/corte-dobra/retalhos" element={<RetalhosCD />} />
        <Route path="/corte-dobra/calculos" element={<CalculosCD />} />
        <Route path="/corte-dobra/maquina/corte-3m" element={<Corte3m />} />
        <Route path="/corte-dobra/maquina/dobra-3m" element={<Dobra3m />} />
        <Route path="/corte-dobra/maquina/corte-6m" element={<Corte6m />} />
        <Route path="/corte-dobra/maquina/dobra-fundo-6m" element={<DobraFundo6m />} />
        <Route path="/corte-dobra/maquina/dobra-inicio-6m" element={<DobraInicio6m />} />
        <Route path="/corte-dobra/maquina/perfiladeira" element={<Perfiladeira />} />
        <Route path="/corte-dobra/mapa" element={<MapaBarracao />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App