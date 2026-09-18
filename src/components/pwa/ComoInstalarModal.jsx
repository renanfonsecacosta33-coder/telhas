import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Smartphone, 
  Monitor, 
  CheckCircle2, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  Tablet
} from "lucide-react";

export default function ComoInstalarModal({ open, onOpenChange }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    // Verificar se já está rodando como app standalone instalado
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) {
      setInstalado(true);
    }

    // Capturar o evento nativo de instalação do navegador
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.deferredPwaPrompt = e;
    };

    if (window.deferredPwaPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    window.addEventListener("appinstalled", () => {
      setInstalado(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstalarDireto = async () => {
    const prompt = deferredPrompt || window.deferredPwaPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setInstalado(true);
        onOpenChange(false);
      }
      setDeferredPrompt(null);
      window.deferredPwaPrompt = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-orange-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Instalar App AJL Fábricas
                <Badge className="bg-emerald-600 text-white text-[10px] uppercase tracking-wider">
                  PWA Dedicado
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Roda em tela cheia como aplicativo nativo, sem barra de navegação do Google e com acesso rápido.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {instalado ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
              O aplicativo já está instalado neste aparelho!
            </h4>
            <p className="text-xs text-muted-foreground">
              Você já está utilizando a versão de aplicativo ou ele já se encontra na sua Área de Trabalho / Tela Inicial.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Se o navegador permitir instalação com 1 clique */}
            {(deferredPrompt || window.deferredPwaPrompt) && (
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-primary text-xs">Instalação Direta Disponível!</p>
                  <p className="text-[11px] text-muted-foreground">Seu navegador suporta instalar com apenas 1 clique agora.</p>
                </div>
                <Button
                  onClick={handleInstalarDireto}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 px-4 gap-1.5 shrink-0 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Instalar Agora
                </Button>
              </div>
            )}

            {/* Passo a Passo para Computador (Chrome / Edge) */}
            <div className="border border-border rounded-xl p-3.5 space-y-2.5 bg-card">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Monitor className="w-4 h-4 text-blue-500" />
                <span>No Computador (Google Chrome ou Edge)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-[11px] pl-1">
                <li>
                  Olhe para a <strong>barra de endereço</strong> no topo do navegador (onde fica o link do site).
                </li>
                <li>
                  No cantinho direito (perto da estrelinha de favoritos), clique no ícone de <strong>computadorzinho com setinha</strong> ou botão <strong>"Instalar"</strong>.
                </li>
                <li>
                  Ou clique nos <strong>3 pontinhos (⋮)</strong> no canto superior direito do Chrome ➔ <strong>"Salvar e Compartilhar"</strong> ➔ <strong>"Instalar AJL Fábricas..."</strong>.
                </li>
              </ol>
            </div>

            {/* Passo a Passo para Tablet / Celular (Android) */}
            <div className="border border-border rounded-xl p-3.5 space-y-2.5 bg-card">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Tablet className="w-4 h-4 text-orange-500" />
                <span>No Tablet ou Celular (Android / Chão de Fábrica)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-[11px] pl-1">
                <li>
                  No Google Chrome, toque nos <strong>3 pontinhos (⋮)</strong> no topo superior direito.
                </li>
                <li>
                  Toque na opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </li>
                <li>
                  Confirme em <strong>"Instalar"</strong>. O ícone oficial da AJL Fábricas aparecerá na tela inicial como um app normal!
                </li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Entendido, fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
