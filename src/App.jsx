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