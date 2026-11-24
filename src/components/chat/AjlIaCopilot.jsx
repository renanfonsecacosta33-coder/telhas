import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useFilial } from "@/contexts/FilialContext";
import {
  Sparkles, Send, X, Maximize2, Minimize2, Settings, RefreshCw,
  FileText, ExternalLink, Bot, Check, AlertCircle, ShieldCheck,
  Zap, Factory, Package, ArrowRight, CornerDownLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AjlIaCopilot() {
  const [aberto, setAberto] = useState(false);
  const [maximizado, setMaximizado] = useState(false);
  const [mensagens, setMensagens] = useState([
    {
      id: "boas_vindas",
      remetente: "ia",
      texto: "Olá! Sou o **AJL IA**, seu assistente operacional de chão de fábrica 🏭.\n\nPosso consultar status de qualquer pedido, perfiladeiras rodando, estoque de bobinas e relatórios em tempo real.\n\nComo posso ajudar agora?",
      data: new Date()
    }
  ]);
  const [inputTexto, setInputTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Estados de Configuração
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [zapiInstanceId, setZapiInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [telefonesAutorizados, setTelefonesAutorizados] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [configId, setConfigId] = useState(null);

  const { filialAtiva } = useFilial();
  const messagesEndRef = useRef(null);

  // Rolagem suave para o fim da conversa
  const scrollParaFim = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (aberto) scrollParaFim();
  }, [mensagens, aberto]);

  // Carrega configurações existentes do banco
  useEffect(() => {
    base44.entities.ConfiguracaoIA.list("-created_date", 1)
      .then((res) => {
        if (res && res.length > 0) {
          const c = res[0];
          setConfigId(c.id);
          if (c.gemini_api_key) setGeminiApiKey(c.gemini_api_key);
          setZapiInstanceId(c.zapi_instance_id || "");
          setZapiToken(c.zapi_token || "");
          setTelefonesAutorizados(c.telefones_autorizados || "");
        }
      })
      .catch(() => {});
  }, []);

  const salvarConfiguracoes = async () => {
    setSalvandoConfig(true);
    try {
      // Salva de forma ultra confiável via backend com service role
      await base44.functions.invoke("ajlIaChat", {
        acao: "salvar_config",
        gemini_api_key: geminiApiKey.trim(),
        zapi_instance_id: zapiInstanceId.trim(),
        zapi_token: zapiToken.trim(),
        telefones_autorizados: telefonesAutorizados.trim()
      });
      toast.success("Chave e configurações do AJL IA salvas com sucesso!");
      setConfigOpen(false);
    } catch (err) {
      toast.error("Falha ao salvar configurações: " + (err?.message || "Erro"));
    } finally {
      setSalvandoConfig(false);
    }
  };

  const enviarMensagem = async (textoPersonalizado) => {
    const texto = (textoPersonalizado || inputTexto).trim();
    if (!texto || carregando) return;

    setInputTexto("");

    const novaMsgUsuario = {
      id: "u_" + Date.now(),
      remetente: "usuario",
      texto,
      data: new Date()
    };

    setMensagens(prev => [...prev, novaMsgUsuario]);
    setCarregando(true);

    // Monta histórico reduzido para contexto
    const historicoRecente = mensagens.slice(-4).map(m => ({
      role: m.remetente === "usuario" ? "user" : "model",
      content: m.texto
    }));

    try {
      const res = await base44.functions.invoke("ajlIaChat", {
        mensagem: texto,
        filial: filialAtiva || "Matriz AJL",
        historico_recente: historicoRecente
      });

      const dadosResposta = res?.data || res;

      const novaMsgIa = {
        id: "ia_" + Date.now(),
        remetente: "ia",
        texto: dadosResposta?.texto || "Operação concluída.",
        tools_usadas: dadosResposta?.tools_usadas || [],
        pdf_url: dadosResposta?.pdf_url,
        pdf_nome: dadosResposta?.pdf_nome,
        data: new Date()
      };

      setMensagens(prev => [...prev, novaMsgIa]);
    } catch (err) {
      setMensagens(prev => [
        ...prev,
        {
          id: "err_" + Date.now(),
          remetente: "ia",
          texto: "⚠️ **AJL IA:** Ocorreu uma oscilação na consulta. Verifique sua chave do Gemini nas configurações ou tente novamente.",
          data: new Date()
        }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <>
      {/* ══════════════ BOTÃO FLUTUANTE AJL IA ══════════════ */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20 group"
          title="Abrir AJL IA - Copiloto de Chão de Fábrica"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-blue-700" />
          </div>
          <span className="font-black text-sm tracking-wide">AJL IA</span>
          <span className="hidden sm:inline text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
            Copiloto
          </span>
        </button>
      )}

      {/* ══════════════ JANELA / PAINEL COPILOT AJL IA ══════════════ */}
      {aberto && (
        <div
          className={`fixed z-50 flex flex-col bg-white border border-slate-300/80 shadow-2xl rounded-2xl transition-all duration-300 overflow-hidden ${
            maximizado
              ? "inset-4 sm:inset-8"
              : "bottom-5 right-5 w-[94vw] sm:w-[440px] h-[620px] max-h-[88vh]"
          }`}
        >
          {/* Topo do Chat */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-3.5 flex items-center justify-between border-b border-white/10 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/90 border border-blue-400/40 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm tracking-tight text-white">AJL IA</h3>
                  <Badge variant="outline" className="text-[10px] uppercase font-black bg-emerald-500/20 text-emerald-300 border-emerald-400/30 px-1.5 py-0">
                    Online
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  Inteligência Operacional · {filialAtiva || "Matriz AJL"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button
                onClick={() => setConfigOpen(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title="Configurações de API & WhatsApp"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMaximizado(!maximizado)}
                className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title={maximizado ? "Restaurar tamanho" : "Maximizar"}
              >
                {maximizado ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setAberto(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.remetente === "usuario" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    msg.remetente === "usuario"
                      ? "bg-blue-600 text-white rounded-tr-xs"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs"
                  }`}
                >
                  {/* Badge de ferramentas usadas */}
                  {msg.tools_usadas && msg.tools_usadas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {msg.tools_usadas.map((t, i) => (
                        <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200">
                          ⚡ {t.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Conteúdo formatado da mensagem */}
                  <div className="whitespace-pre-wrap break-words space-y-1">
                    {msg.texto}
                  </div>

                  {/* Anexo de PDF encontrado */}
                  {msg.pdf_url && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <a
                        href={msg.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-red-600" />
                        {msg.pdf_nome || "Abrir PDF Oficial do Pedido"}
                        <ExternalLink className="w-3 h-3 text-red-500 ml-0.5" />
                      </a>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {carregando && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2 w-fit shadow-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>AJL IA consultando o chão de fábrica...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões Rápidas quando poucas mensagens */}
          {mensagens.length <= 2 && (
            <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap gap-1.5">
              <button
                onClick={() => enviarMensagem("Como está o ritmo da fábrica de telhas hoje?")}
                className="text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                📊 Ritmo da fábrica hoje
              </button>
              <button
                onClick={() => enviarMensagem("Quais perfiladeiras estão rodando agora?")}
                className="text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                ⚡ Perfiladeiras ativas
              </button>
              <button
                onClick={() => enviarMensagem("Quais pedidos estão com prazo crítico ou atrasados?")}
                className="text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                ⚠️ Pedidos urgentes/atrasados
              </button>
              <button
                onClick={() => enviarMensagem("Como está o estoque de bobinas 0.43?")}
                className="text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                📦 Estoque bobina 0.43
              </button>
            </div>
          )}

          {/* Campo de Digitação */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <textarea
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ao AJL IA sobre qualquer pedido, máquina ou bobina..."
              className="flex-1 text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-24 h-10 scrollbar-thin"
              rows={1}
            />
            <Button
              onClick={() => enviarMensagem()}
              disabled={!inputTexto.trim() || carregando}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-3 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL DE CONFIGURAÇÕES DE IA & Z-API ══════════════ */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Settings className="w-5 h-5 text-blue-600" /> Configurações do AJL IA
            </DialogTitle>
            <DialogDescription>
              Gerencie a chave do cérebro de IA (Google Gemini) e as credenciais do WhatsApp (Z-API).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Chave Gemini */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Chave da API Google Gemini (AI Studio):
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Obtida gratuitamente em aistudio.google.com
              </p>
            </div>

            {/* Z-API Instance ID */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Z-API — ID da Instância (WhatsApp):
              </label>
              <input
                type="text"
                value={zapiInstanceId}
                onChange={(e) => setZapiInstanceId(e.target.value)}
                placeholder="Ex: 3C0A9B..."
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-900"
              />
            </div>

            {/* Z-API Token */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Z-API — Token da Instância:
              </label>
              <input
                type="password"
                value={zapiToken}
                onChange={(e) => setZapiToken(e.target.value)}
                placeholder="Token do Z-API"
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-900"
              />
            </div>

            {/* Telefones Autorizados */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Telefones Autorizados no WhatsApp (separados por vírgula):
              </label>
              <textarea
                value={telefonesAutorizados}
                onChange={(e) => setTelefonesAutorizados(e.target.value)}
                placeholder="Ex: 5541999999999, 5541888888888"
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-900 resize-none h-16"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Apenas esses números conseguirão conversar com a IA no WhatsApp.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={salvarConfiguracoes}
              disabled={salvandoConfig}
            >
              {salvandoConfig ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
