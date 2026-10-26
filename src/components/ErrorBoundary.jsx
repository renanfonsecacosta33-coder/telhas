import React from "react";
import { RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registrarErroTelemetria } from "@/lib/diagnosticoSistemaHelper";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Erro crítico capturado:", error, errorInfo);
    this.setState({ errorInfo });
    try {
      registrarErroTelemetria("RenderizacaoUI", error?.message || "Exceção visual em componente", errorInfo?.componentStack);
    } catch {}
  }

  handleReload = () => {
    window.location.reload();
  };

  handleLimparCacheERecarregar = () => {
    try {
      sessionStorage.clear();
      // Limpa dados de cache sem apagar credenciais de auth essenciais
      const chavesParaManter = ["auth", "token", "user", "filial"];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !chavesParaManter.some(k => key.toLowerCase().includes(k))) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
    window.location.href = window.location.origin;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-2">Instabilidade Temporária</h2>
            <p className="text-sm text-slate-400 mb-6">
              O aplicativo encontrou uma oscilação na renderização. Clique abaixo para restabelecer a conexão imediata.
            </p>

            <div className="w-full flex flex-col gap-3">
              <Button
                onClick={this.handleReload}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold h-11 gap-2 shadow-lg shadow-teal-900/30"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Sistema
              </Button>

              <Button
                variant="outline"
                onClick={this.handleLimparCacheERecarregar}
                className="w-full border-slate-700 hover:bg-slate-800 text-slate-300 text-xs h-10 gap-2"
              >
                Limpar Cache e Reiniciar
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>AJL Sistema Fabril Inteligente</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
