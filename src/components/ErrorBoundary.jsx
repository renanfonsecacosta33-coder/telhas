import React from "react";
import { RefreshCw, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registrarErroTelemetria } from "@/lib/diagnosticoSistemaHelper";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      mostrarDetalhes: false,
      copiado: false,
    };
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

  handleCopiarErro = () => {
    const texto = `[Erro AJL]: ${this.state.error?.message || "Sem mensagem"}\n\nStack:\n${this.state.error?.stack || ""}\n\nComponentStack:\n${this.state.errorInfo?.componentStack || ""}`;
    navigator.clipboard?.writeText(texto).then(() => {
      this.setState({ copiado: true });
      setTimeout(() => this.setState({ copiado: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white p-6 overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center my-auto">
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
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold h-11 gap-2 shadow-lg shadow-teal-900/30 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Sistema
              </Button>

              <Button
                variant="outline"
                onClick={this.handleLimparCacheERecarregar}
                className="w-full border-slate-700 hover:bg-slate-800 text-slate-300 text-xs h-10 gap-2 cursor-pointer"
              >
                Limpar Cache e Reiniciar
              </Button>

              <button
                type="button"
                onClick={() => this.setState(s => ({ mostrarDetalhes: !s.mostrarDetalhes }))}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 mt-2 cursor-pointer transition-colors"
              >
                <span>{this.state.mostrarDetalhes ? "Ocultar detalhes técnicos" : "Ver detalhes do erro"}</span>
                {this.state.mostrarDetalhes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {this.state.mostrarDetalhes && (
                <div className="w-full mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono text-red-300 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                    <span>Exceção:</span>
                    <button
                      type="button"
                      onClick={this.handleCopiarErro}
                      className="flex items-center gap-1 text-teal-400 hover:underline cursor-pointer"
                    >
                      {this.state.copiado ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{this.state.copiado ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                  <p className="break-all font-bold text-red-400">
                    {this.state.error?.message || String(this.state.error)}
                  </p>
                  {this.state.error?.stack && (
                    <pre className="text-[10px] text-slate-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {this.state.error.stack.slice(0, 500)}...
                    </pre>
                  )}
                </div>
              )}
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
