import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useFilial } from "@/contexts/FilialContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Sparkles, Send, Bot, User, RotateCcw, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isCopilotOculto, setCopilotOculto, COPILOT_TOGGLE_EVENT } from "@/lib/copilotPrefs";

// Helper para normalizar texto (remove acentos, pontuação e caixa alta)
function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const fmtKg = (n) => Math.round(n || 0).toLocaleString("pt-BR");
const agora = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Resume as bobinas reais de um setor (agregações feitas no cliente)
function resumirBobinas(items) {
  const porEspessura = {};
  let totalKg = 0;
  let reservadasKg = 0;
  let reservadasQtd = 0;
  const estoqueBaixo = [];

  items.forEach(b => {
    const kg = b.peso_kg || 0;
    totalKg += kg;
    const esp = b.chapa || "s/ info";
    porEspessura[esp] = (porEspessura[esp] || 0) + kg;
    if (b.reservada) {
      reservadasKg += kg;
      reservadasQtd++;
    }
    const min = typeof b.estoque_minimo_kg === "number" ? b.estoque_minimo_kg : 0;
    if (kg > 0 && min > 0 && kg <= min) {
      estoqueBaixo.push({
        codigo: b.codigo || "—",
        descricao: `${b.chapa || "?"}mm ${b.cor || b.qualidade || ""}`.trim(),
        kg: Math.round(kg)
      });
    }
  });

  return {
    quantidade: items.length,
    totalKg: Math.round(totalKg),
    reservadasQtd,
    reservadasKg: Math.round(reservadasKg),
    livresKg: Math.round(totalKg - reservadasKg),
    porEspessura,
    estoqueBaixo: estoqueBaixo.slice(0, 10)
  };
}

// Texto de resumo real de um setor de bobinas
function textoResumoBobinas(titulo, r) {
  const espessuras = Object.entries(r.porEspessura)
    .sort((a, b) => b[1] - a[1])
    .map(([esp, kg]) => `- ${esp}mm — ${fmtKg(kg)} kg`)
    .join("\n");

  return `### ${titulo}\n\n` +
    `- ⚖️ **Peso total:** ${fmtKg(r.totalKg)} kg em ${r.quantidade} bobina(s)\n` +
    `- 🔒 **Reservado:** ${fmtKg(r.reservadasKg)} kg (${r.reservadasQtd} bobina(s))\n` +
    `- ✅ **Livre:** ${fmtKg(r.livresKg)} kg\n\n` +
    `**Por espessura (chapa):**\n${espessuras || "- Sem bobinas ativas"}`;
}

export default function AjlCopilot() {
  const { user } = useAuth();
  const { filialAtiva } = useFilial();
  const [oculto, setOculto] = useState(() => isCopilotOculto());
  const [open, setOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState(null);
  const [carregandoCtx, setCarregandoCtx] = useState(false);
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: `Olá, ${user?.full_name ? user.full_name.split(" ")[0] : "gestor"}! 👋 Sou o **IA AJL Copilot**.\n\nConsulto os **dados reais** do sistema da filial ativa — bobinas, estoque baixo, chapas e OPs em andamento — e respondo perguntas livres usando IA.\n\nExperimente: *"quais bobinas estão com estoque baixo?"* ou *"resumo do estoque de telhas"*.`,
      timestamp: agora()
    }
  ]);

  useEffect(() => {
    const handler = () => setOculto(isCopilotOculto());
    window.addEventListener(COPILOT_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(COPILOT_TOGGLE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Carrega um retrato real da operação da filial ativa
  const carregarContexto = async () => {
    setCarregandoCtx(true);
    try {
      const [bobinasTelhas, bobinasCD, opsProd, opsPend, opsCdProd, chapasDisp, slittersLivres] =
        await Promise.all([
          base44.entities.Bobina.filter(
            { setor: "telhas", arquivada: false, unidade: filialAtiva },
            { sort: "-peso_kg", limit: 200 }
          ),
          base44.entities.Bobina.filter(
            { setor: "corte_dobra", arquivada: false, unidade: filialAtiva },
            { sort: "-peso_kg", limit: 200 }
          ),
          base44.entities.Pedido.count({ unidade: filialAtiva, status: "em_producao" }),
          base44.entities.Pedido.count({ unidade: filialAtiva, status: "pendente" }),
          base44.entities.OrdemMaquinaCD.count({ unidade: filialAtiva, status: "em_producao" }),
          base44.entities.ChapaCD.count({ unidade: filialAtiva, status: "disponivel" }),
          base44.entities.Slitter.count({ unidade: filialAtiva, reservada: false })
        ]);

      const ctx = {
        filial: filialAtiva,
        bobinasTelhas: resumirBobinas(bobinasTelhas.items || []),
        bobinasCD: resumirBobinas(bobinasCD.items || []),
        opsTelhasEmProducao: opsProd,
        opsTelhasPendentes: opsPend,
        opsCDEmProducao: opsCdProd,
        lotesChapasDisponiveis: chapasDisp,
        slittersLivres: slittersLivres,
        atualizadoEm: new Date().toLocaleString("pt-BR")
      };
      setContexto(ctx);
      return ctx;
    } catch (err) {
      console.error("Erro ao carregar contexto do Copilot:", err);
      toast.error("Não consegui carregar os dados agora. Tente atualizar.");
      return null;
    } finally {
      setCarregandoCtx(false);
    }
  };

  useEffect(() => {
    if (open && !contexto && !carregandoCtx) {
      carregarContexto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const SUGGESTED_PROMPTS = [
    { label: "⚠️ Bobinas com estoque baixo", query: "quais bobinas estão com estoque baixo?" },
    { label: "⚖️ Resumo do estoque de telhas", query: "resumo do estoque de bobinas de telhas" },
    { label: "✂️ Bobinas do Corte e Dobra", query: "quais bobinas temos no corte e dobra?" },
    { label: "🏭 OPs em andamento", query: "quantas OPs estão em produção agora?" }
  ];

  // Comandos rápidos respondidos com dados reais (sem IA)
  const responderComDadosReais = (userText, ctx) => {
    const n = normalize(userText);

    // Estoque baixo
    if (n.includes("baixo") || n.includes("alerta") || n.includes("critico") || n.includes("acabando")) {
      const baixas = [
        ...ctx.bobinasTelhas.estoqueBaixo.map(b => ({ ...b, setor: "Telhas" })),
        ...ctx.bobinasCD.estoqueBaixo.map(b => ({ ...b, setor: "Corte e Dobra" }))
      ];
      if (baixas.length === 0) {
        return `### ✅ Nenhum alerta de estoque baixo\n\nTodas as bobinas ativas da filial **${ctx.filial}** estão acima do mínimo configurado.`;
      }
      const linhas = baixas.map(b => `- **${b.codigo}** (${b.setor}) — ${b.descricao} — apenas **${b.kg} kg**`).join("\n");
      return `### ⚠️ ${baixas.length} bobina(s) com estoque baixo — ${ctx.filial}\n\n${linhas}\n\n> Dados consultados agora no sistema (${ctx.atualizadoEm}).`;
    }

    // Bobinas do Corte e Dobra
    if ((n.includes("corte") || n.includes("dobra") || n.includes(" cd ")) &&
        (n.includes("bobina") || n.includes("estoque") || n.includes("material") || n.includes("temos") || n.includes("resumo"))) {
      return textoResumoBobinas(`Bobinas do Corte e Dobra — ${ctx.filial}`, ctx.bobinasCD);
    }

    // Bobinas de Telhas
    if ((n.includes("telha") || n.includes("telhas")) &&
        (n.includes("bobina") || n.includes("estoque") || n.includes("material") || n.includes("temos") || n.includes("resumo"))) {
      return textoResumoBobinas(`Bobinas de Telhas — ${ctx.filial}`, ctx.bobinasTelhas);
    }

    // OPs em andamento
    if (n.includes(" op") || n.includes("ops") || n.includes("producao") || n.includes("andamento") || n.includes("fila")) {
      return `### 🏭 Produção em andamento — ${ctx.filial}\n\n` +
        `- ⚡ OPs de Telhas em produção: **${ctx.opsTelhasEmProducao}**\n` +
        `- ⏳ OPs de Telhas pendentes: **${ctx.opsTelhasPendentes}**\n` +
        `- ✂️ OPs de C&D em produção: **${ctx.opsCDEmProducao}**\n` +
        `- 📦 Lotes de chapas disponíveis: **${ctx.lotesChapasDisponiveis}**\n` +
        `- 🌀 Bobinas slitter livres: **${ctx.slittersLivres}**\n\n` +
        `> Dados consultados agora (${ctx.atualizadoEm}).`;
    }

    return null;
  };

  const buildPrompt = (pergunta, ctx) =>
    `Você é o "IA AJL Copilot", assistente interno da AJL Ferro & Aço (fábrica de telhas galvalume e corte e dobra de aço). ` +
    `Responda em português do Brasil, de forma curta, direta e profissional.\n\n` +
    `Use APENAS os dados reais abaixo como fonte. Se a pergunta não puder ser respondida com eles, diga honestamente o que falta. ` +
    `Não invente números, códigos ou ações executadas.\n\n` +
    `Filial ativa: ${ctx.filial}\n` +
    `Dados reais consultados agora (${ctx.atualizadoEm}):\n${JSON.stringify(ctx)}\n\n` +
    `Pergunta do usuário: ${pergunta}`;

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    setMessages(prev => [
      ...prev,
      { id: Date.now(), sender: "user", text, timestamp: agora() }
    ]);
    if (!textToSend) setInputMessage("");
    setIsTyping(true);

    try {
      let ctx = contexto;
      if (!ctx) ctx = await carregarContexto();

      let resposta = null;
      if (ctx) {
        resposta = responderComDadosReais(text, ctx);
      }

      if (!resposta) {
        // Pergunta livre: IA com os dados reais como contexto
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: buildPrompt(text, ctx || { filial: filialAtiva, erro: "dados não carregados" })
        });
        resposta = typeof res === "string" ? res : res?.response || String(res);
      }

      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, sender: "bot", text: resposta, timestamp: agora() }
      ]);
    } catch (err) {
      console.error("Erro no Copilot:", err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: "⚠️ **Ops!** Tive um problema ao consultar agora. Tente novamente em instantes ou toque no botão de atualizar dados.",
          timestamp: agora()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOcultar = () => {
    setCopilotOculto(true);
    setOpen(false);
    toast.info("Copilot oculto. Para reativar, abra Minha Conta → IA AJL Copilot.");
  };

  // Somente administradores veem o Copilot
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  if (!isAdmin || oculto) return null;

  return (
    <>
      {/* Botão Flutuante de Ativação da IA Copilot */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary via-purple-600 to-indigo-600 text-white font-bold text-sm rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-white/20"
      >
        <Sparkles className="w-5 h-5 text-yellow-300" />
        <span className="hidden sm:inline">IA AJL Copilot</span>
      </button>

      {/* Painel Lateral */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="border-l border-border bg-slate-950 text-slate-100 flex flex-col p-0 shadow-2xl w-full sm:w-[650px] max-w-none sm:max-w-none">

          <SheetHeader className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-white flex items-center gap-2">
                  IA AJL Copilot
                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px] py-0 font-mono">dados reais</Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  {carregandoCtx ? "Consultando o sistema…" : `Filial ${filialAtiva} • ${contexto ? "dados atualizados" : "dados carregam ao abrir"}`}
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => carregarContexto()}
                disabled={carregandoCtx}
                className="text-slate-400 hover:text-white"
                title="Atualizar dados reais"
              >
                <RotateCcw className={cn("w-4 h-4", carregandoCtx && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOcultar}
                className="text-slate-400 hover:text-white"
                title="Ocultar Copilot (reative em Minha Conta)"
              >
                <EyeOff className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-[96%] text-xs sm:text-sm leading-relaxed",
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border mt-0.5 shadow-sm",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground border-primary/40"
                    : "bg-purple-950 text-purple-300 border-purple-700/50"
                )}>
                  {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={cn(
                  "p-3.5 sm:p-4 rounded-2xl border shadow-md w-full",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground border-primary/50 rounded-tr-none max-w-md"
                    : "bg-slate-900 text-slate-100 border-slate-800 rounded-tl-none"
                )}>
                  <div className="whitespace-pre-wrap font-sans overflow-x-auto">
                    {msg.text.split("\n").map((line, i) => {
                      if (line.startsWith("### ")) {
                        return (
                          <h3 key={i} className="font-bold text-sm sm:text-base text-purple-300 mt-2 mb-1">
                            {line.replace("### ", "")}
                          </h3>
                        );
                      }
                      if (line.startsWith("> ")) {
                        return (
                          <blockquote key={i} className="border-l-3 border-purple-500 pl-2.5 italic text-purple-200 bg-purple-950/30 py-1.5 rounded-r-md my-1.5">
                            {line.replace("> ", "")}
                          </blockquote>
                        );
                      }
                      return <p key={i} className="my-0.5 text-slate-200">{line}</p>;
                    })}
                  </div>
                  <span className="text-[10px] text-slate-400 block text-right">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center text-xs text-purple-400 p-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Consultando dados reais do sistema...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões */}
          <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 overflow-x-auto flex gap-2">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt.query)}
                disabled={isTyping}
                className="whitespace-nowrap text-[11px] bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-purple-600 transition-all shrink-0 cursor-pointer font-medium disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Input de Mensagem */}
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <Input
              placeholder="Pergunte sobre bobinas, OPs, estoque, chapas..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 h-10 text-xs sm:text-sm focus-visible:ring-purple-500 rounded-xl"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isTyping}
              className="h-10 px-4 shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl gap-2 text-xs sm:text-sm"
            >
              <span>Perguntar</span>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}