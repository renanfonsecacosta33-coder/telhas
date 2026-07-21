import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Factory, 
  Scissors, 
  Truck, 
  BookmarkPlus, 
  HelpCircle, 
  Calculator, 
  ShieldAlert, 
  X, 
  RotateCcw,
  Clock,
  Layers,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------
// BASE DE CONHECIMENTO INDUSTRIAL & REGRAS DE NEGÓCIO AJL
// ----------------------------------------------------
const AJL_KNOWLEDGE_BASE = {
  empresa: "AJL Ferro & Aço — Líder em transformação siderúrgica, corte e dobra sob medida e fabricação de telhas termoacústicas e perfis estruturais.",
  unidades: ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"],
  setores: {
    telhas: "Barracão Telhas: Produção de telhas trapezoidais (TP-25, TP-40), onduladas, coloniais, painéis de colagem EPS e cumeeiras.",
    corte_dobra: "Barracão Corte e Dobra: Processamento de perfis U, calhas, rufos, chaparia e corte longitudinal/transversal (Corte 3M/6M, Dobra 3M/6M, Perfiladeiras, Slitter).",
    logistica: "Expedição e Frota: Gestão de carregamento, pesagem em balança rodoviária, emissão de romaneios e rotas de entrega (Toco, Truck, Bitrem).",
    estoque: "Estoque Rápido: Gestão de bobinas master (Galvalume, Zincada, Pré-Pintadas CSN/ArcelorMittal/Usiminas) e retalhos."
  }
};

export default function AjlCopilot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: `Olá, ${user?.full_name ? user.full_name.split(' ')[0] : 'operador'}! 👋 Sou a **IA Assistente da AJL Ferro & Aço**.\n\nEstou pronta para ajudar você com qualquer dúvida sobre **operações de fábrica, cálculo de bobinas, procedimentos de OPs, logística, regras do ERP e horas extras**! Como posso te ajudar hoje?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  // Perguntas Sugeridas Rápidas
  const SUGGESTED_PROMPTS = [
    { label: " Como lançar uma OP no Barracão?", query: "Como faço para iniciar e lançar uma Ordem de Produção no barracão?" },
    { label: "🧮 Calcular peso de telha Galvalume", query: "Como calcular o peso teórico de uma telha trapezoidal TP-40?" },
    { label: "🕒 Como funciona o App de Hora Extra?", query: "Como funciona a integração do aplicativo de Hora Extra da AJL?" },
    { label: "⚠️ Pular foto da balança e bypasses", query: "Quem tem permissão para pular foto da balança e liberar bypass de OP?" }
  ];

  // Motor de Inteligência & Resposta Customizada para a AJL
  const generateAiResponse = (userText) => {
    const text = userText.toLowerCase();

    // 1. Dúvidas de Ordem de Produção & Fábrica
    if (text.includes("op") || text.includes("ordem de produção") || text.includes("lançar") || text.includes("iniciar")) {
      return `### 🏭 Procedimento de Lançamento de OP — AJL MES\n\n1. **Seleção de Máquina:** Acesse a tela da sua máquina (ex: *TP-40* ou *Dobra 3M*).\n2. **Identificação da Bobina:** Escaneie o QR Code ou selecione o código da bobina master alocada.\n3. **Execução:** O sistema informará a metragem e quantidade de peças solicitadas pelo cliente.\n4. **Balança & Foto:** Ao concluir, registre o peso real na balança e tire a foto para validação de qualidade (ou use o bypass de *Pular Foto* se autorizado pelo Encarregado).\n\n> 💡 **Dica da IA:** Em caso de divergência de peso superior a 3%, solicite a autorização do **Encarregado de Produção**!`;
    }

    // 2. Cálculo de Peso & Aço
    if (text.includes("calcular") || text.includes("peso") || text.includes("galvalume") || text.includes("tp-40") || text.includes("tp-25") || text.includes("fórmula")) {
      return `### 🧮 Cálculo Técnico de Peso para Aços Planos & Telhas\n\nA fórmula padrão usada na **AJL Ferro & Aço** para calcular o peso teórico é:\n\n$$\\text{Peso (kg)} = \\text{Metros} \\times \\text{Largura (m)} \\times \\text{Espessura (mm)} \\times 7.85$$\n\n**Exemplo Prático (Telha TP-40 0.43mm):**\n- Largura do desenvolvimento da chapa: **1,20m**\n- Espessura nominal: **0.43mm**\n- Peso por metro linear aproximado: **~4.05 kg/m**\n- Para uma telha de 6.00m: **~24.30 kg por peça**.`;
    }

    // 3. Hora Extra & Ponto
    if (text.includes("hora extra") || text.includes("ponto") || text.includes("jornada") || text.includes("escala")) {
      return `### 🕒 Integração com o App de Hora Extra AJL\n\n- **Acesso ao App:** O aplicativo mestre está integrado em [\`hora-extra.base44.app\`](https://hora-extra.base44.app).\n- **Quem pode acessar:** Conforme definido no sistema de permissões Odoo-style da AJL, o acesso ao lançamento e aprovação de horas extras é garantido para **Encarregados de Barracão** e **Administradores**.\n- **Acesso Rápido:** Você pode clicar no botão *"Lançar Hora Extra"* no seu menu de perfil lateral ou através do cartão no menu principal.`;
    }

    // 4. Permissões, Regras e Bypasses
    if (text.includes("permissão") || text.includes("regras") || text.includes("bypass") || text.includes("balança") || text.includes("foto")) {
      return `### 🛡️ Permissões e Alçadas de Segurança Odoo-Style\n\nA **AJL Ferro & Aço** conta com um motor de **50+ regras operacionais** divididas por setores:\n\n- **Encarregados:** Podem autorizar bypasses de OP, pular foto da balança, reatribuir operadores e alterar a cadência de linha.\n- **Operadores:** Têm acesso restrito às máquinas associadas ao seu turno.\n- **Vendedores:** Têm permissão para conceder descontos e consultar o estoque em tempo real.\n\n> ⚙️ Administradores podem configurar as permissões de cada colaborador na tela de **Usuários**.`;
    }

    // 5. Logística, Frota & Expedição
    if (text.includes("logística") || text.includes("caminhão") || text.includes("romaneio") || text.includes("carga") || text.includes("balança rodoviária")) {
      return `### 🚚 Logística & Carregamento de Frota\n\n- **Controle de Romaneios:** A expedição monta as cargas separando por cidade e rota de entrega.\n- **Limites de Peso:**\n  - **Toco:** Ates 8.000 kg\n  - **Truck (6x2):** Até 14.000 kg\n  - **Bitrem:** Até 37.000 kg de carga útil.\n- **Canhotos:** Toda entrega finalizada deve ter a imagem do canhoto faturado sincronizada no ERP.`;
    }

    // 6. Resposta Genérica Inteligente sobre a AJL
    return `### 🤖 Inteligência Operacional AJL Ferro & Aço\n\nEntendi sua solicitação sobre **"${userText}"**!\n\nNo ERP da AJL, todas as operações estão interconectadas em tempo real entre o **Barracão de Telhas**, **Corte e Dobra**, **Estoque de Bobinas**, **Logística** e **Gestão Financeira**.\n\nComo posso detalhar melhor esse procedimento para o seu turno? Você pode me perguntar sobre:\n- *Lançamento de OPs e Bypasses*\n- *Cálculos de Metragem e Peso de Aço*\n- *Status de Bobinas em Estoque*\n- *Regras de Horas Extras e Turnos*`;
  };

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");
    setIsTyping(true);

    // Simula resposta inteligente rápida da IA
    setTimeout(() => {
      const aiReplyText = generateAiResponse(text);
      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <>
      {/* Botão Flutuante de Ativação da IA Copilot */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary via-purple-600 to-indigo-600 text-white font-bold text-sm rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer border border-white/20"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-yellow-300" />
        <span className="hidden sm:inline">IA AJL Copilot</span>
      </button>

      {/* Sheet Lateral da IA Copilot */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:w-[500px] border-l border-border bg-slate-950 text-slate-100 flex flex-col p-0 shadow-2xl">
          
          {/* Header da IA */}
          <SheetHeader className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-white flex items-center gap-2">
                  IA AJL Copilot
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] py-0 font-mono">v2.5 Pro</Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  Assistente de Operações, Regras & Engenharia
                </SheetDescription>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </SheetHeader>

          {/* Área de Mensagens da IA */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex gap-3 max-w-[90%] text-xs sm:text-sm leading-relaxed animate-in fade-in duration-200",
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border mt-0.5",
                  msg.sender === "user" 
                    ? "bg-primary text-primary-foreground border-primary/40" 
                    : "bg-purple-950 text-purple-300 border-purple-700/50"
                )}>
                  {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={cn(
                  "p-3.5 rounded-2xl space-y-2 border",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground border-primary/50 rounded-tr-none"
                    : "bg-slate-900 text-slate-100 border-slate-800 rounded-tl-none shadow-md"
                )}>
                  {/* Formatação Simples de Markdown para Texto da IA */}
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) {
                        return <h3 key={i} className="font-bold text-sm text-purple-300 mt-2 mb-1">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('> ')) {
                        return <blockquote key={i} className="border-l-2 border-purple-500 pl-2 italic text-purple-200 my-1.5">{line.replace('> ', '')}</blockquote>;
                      }
                      return <p key={i} className="my-0.5">{line}</p>;
                    })}
                  </div>

                  <span className="text-[10px] text-slate-400 block text-right">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center text-xs text-purple-400 p-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>IA AJL está analisando dados e gerando resposta...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões de Perguntas Rápidas */}
          <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 overflow-x-auto flex gap-2 scrollbar-none">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt.query)}
                className="whitespace-nowrap text-[11px] bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-purple-600 transition-all shrink-0 cursor-pointer"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Input de Mensagem */}
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <Input 
              placeholder="Pergunte qualquer coisa sobre a fábrica, OPs, cálculo de peso ou regras..." 
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 h-10 text-xs sm:text-sm focus-visible:ring-purple-500"
            />
            <Button 
              onClick={() => handleSendMessage()} 
              disabled={!inputMessage.trim() || isTyping}
              className="h-10 w-10 shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

        </SheetContent>
      </Sheet>
    </>
  );
}
