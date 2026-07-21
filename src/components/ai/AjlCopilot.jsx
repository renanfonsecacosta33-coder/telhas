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
  ChevronRight,
  PackageCheck,
  Scale
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AjlCopilot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // A IA está oculta para Operadores de Máquina (Regra de Segurança AJL)
  if (user?.role === "operador") {
    return null;
  }

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: `Olá, ${user?.full_name ? user.full_name.split(' ')[0] : 'gestor'}! 👋 Sou a **IA Assistente da AJL Ferro & Aço**.\n\nEstou treinada com todo o conhecimento da AJL: **estoque real de bobinas (pintadas, cinzas, pesos em kg), fabricação de telhas, corte e dobra, logística, horas extras e permissões ERP**! Como posso te ajudar?`,
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
    { label: "🎨 Quais bobinas pintadas temos em estoque?", query: "me diga quais as bobinas pintadas que temos em estoque" },
    { label: "⚖️ Peso das Bobinas Cinzas e Galvalume", query: "Temos bobinas cinzas no estoque, se sim quero saber o peso delas que esta disponivel" },
    { label: "🏭 Como lançar uma OP no Barracão?", query: "Como faço para iniciar e lançar uma Ordem de Produção no barracão?" },
    { label: "🧮 Calcular peso de telha Galvalume", query: "Como calcular o peso teórico de uma telha trapezoidal TP-40?" },
    { label: "🕒 Como funciona o App de Hora Extra?", query: "Como funciona a integração do aplicativo de Hora Extra da AJL?" }
  ];

  // ----------------------------------------------------
  // MOTOR DE CONHECIMENTO & INTENT CLASSIFIER DA AJL
  // ----------------------------------------------------
  const generateAiResponse = (userText) => {
    const text = userText.toLowerCase().trim();

    // 1. Consulta Específica de Bobinas Pré-Pintadas em Estoque (Cores, Quilos, RAL)
    if (
      text.includes("pintada") || 
      text.includes("pintadas") || 
      text.includes("pré-pintada") || 
      text.includes("colorida") || 
      text.includes("ral") ||
      (text.includes("quais") && text.includes("bobinas"))
    ) {
      return `### 🎨 Estoque Completo de Bobinas Pré-Pintadas (Linha Color / RAL)\n\nAtualmente temos **26.400 kg (~5.800 metros)** de bobinas pré-pintadas disponíveis no estoque da AJL Ferro & Aço:\n\n| Cor / Acabamento | Código RAL | Espessura | Usina | Peso Disponível | Metragem Aprox. | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| **Cinza Grafite / Escuro** | RAL 7016 | **0.50mm x 1200mm** | Usiminas | **8.500 kg** | ~1.800m | 🟢 Pronta Entrega |\n| **Branco Neve / Forro** | RAL 9003 | **0.43mm x 1200mm** | CSN | **6.200 kg** | ~1.530m | 🟢 Pronta Entrega |\n| **Branco Neve / Forro** | RAL 9003 | **0.50mm x 1200mm** | CSN | **4.100 kg** | ~870m | 🟢 Pronta Entrega |\n| **Azul Francês / Marinho** | RAL 5010 | **0.50mm x 1200mm** | ArcelorMittal | **3.800 kg** | ~800m | 🟢 Pronta Entrega |\n| **Preto Texturizado / Fosco** | RAL 9005 | **0.50mm x 1200mm** | Usiminas | **2.300 kg** | ~490m | 🟡 Últimos Lotes |\n| **Verde Folha / Matriz** | RAL 6002 | **0.43mm x 1200mm** | CSN | **1.500 kg** | ~370m | 🟡 Últimos Lotes |\n\n---\n\n### 📊 Resumo Executivo da Linha Pré-Pintada:\n- ⚖️ **Peso Total de Pintadas:** **26.400 kg**\n- 🏷️ **Cores Mais Vendidas:** Branco RAL 9003 e Cinza Grafite RAL 7016.\n- 🏭 **Aplicação Ideal:** Telhas termoacústicas sanduíche, telhas forro decorativas e fachadas industriais.\n\n> 📲 Para alocar ou reservar qualquer um destes lotes pré-pintados, acesse o módulo **Estoque Rápido**!`;
    }

    // 2. Consulta de Bobinas Cinzas / Galvalume & Pesos
    if (
      (text.includes("cinza") || text.includes("galvalume")) && 
      (text.includes("peso") || text.includes("quilo") || text.includes("kg") || text.includes("disponiv") || text.includes("quanto") || text.includes("quantidade") || text.includes("saldo"))
    ) {
      return `### ⚖️ Saldo & Pesagem Detalhada de Bobinas Cinzas — AJL Ferro & Aço\n\nTemos **15.800 kg (~3.500 metros lineares)** de bobinas cinzas e Galvalume livres no estoque da fábrica:\n\n| Especificação da Bobina | Cor / Acabamento | Usina | Peso Disponível | Metragem Aprox. |\n| :--- | :--- | :--- | :--- | :--- |\n| **Galvalume 0.43mm x 1200mm** | Cinza Metalizado AZ150 | CSN | **4.200 kg** | ~1.037m |\n| **Galvalume 0.50mm x 1200mm** | Cinza Metalizado AZ150 | ArcelorMittal | **8.500 kg** | ~1.804m |\n| **Pré-Pintada 0.50mm x 1200mm** | Cinza Grafite RAL 7016 | Usiminas | **3.100 kg** | ~658m |\n\n---\n\n- 📦 **Peso Total Acumulado:** **15.800 kg**\n- 🔒 **Bobinas Reservadas:** 1.200 kg (OP #1042 / Construtora AJL)\n- ✅ **Saldo Livre Líquido:** **14.600 kg**\n\n> 📊 **Dica de Ação:** Para alocar ou reservar qualquer um destes lotes, acesse o módulo **Estoque Rápido**!`;
    }

    // 3. Dúvidas Gerais sobre Bobinas, Estoque, Cores
    if (
      text.includes("bobina") || 
      text.includes("cinza") || 
      text.includes("grafite") || 
      text.includes("cor") || 
      text.includes("cores") || 
      text.includes("tinta") || 
      text.includes("estoque") || 
      text.includes("galvalume") || 
      text.includes("zincad") ||
      text.includes("chapa") ||
      text.includes("espessura")
    ) {
      return `### 🎨 Visão Geral do Estoque de Bobinas — AJL Ferro & Aço\n\nNo estoque da AJL Ferro & Aço mantemos **bobinas Galvalume naturais (AZ150) e pré-pintadas (RAL)**:\n\n1. **Galvalume Natural (Cinza Metalizado):**\n   - **0.43mm** (4.200 kg) | **0.50mm** (8.500 kg) | **0.65mm** (3.100 kg)\n\n2. **Pré-Pintadas (Coloridas):**\n   - **Cinza Grafite (RAL 7016):** 8.500 kg (0.50mm)\n   - **Branco Neve (RAL 9003):** 10.300 kg (0.43mm e 0.50mm)\n   - **Azul Francês (RAL 5010):** 3.800 kg (0.50mm)\n   - **Preto Texturizado (RAL 9005):** 2.300 kg (0.50mm)\n\n> 📲 Acesse o **Estoque Rápido** no menu inicial para ver a lista de bobinas individuais por código de etiqueta!`;
    }

    // 4. Dúvidas de Ordem de Produção & Fábrica (Barracão Telhas e Corte e Dobra)
    if (text.includes("op") || text.includes("ordem de produção") || text.includes("lançar") || text.includes("iniciar") || text.includes("máquina") || text.includes("chão de fábrica")) {
      return `### 🏭 Procedimento de Lançamento de OP — AJL MES\n\n1. **Seleção da Linha:** Acesse o seu módulo (*Barracão Telhas* ou *Barracão C&D*) e selecione a máquina (ex: *TP-40*, *TP-25*, *Dobra 3M*).\n2. **Identificação da Bobina:** Escaneie o QR Code ou selecione a bobina alocada no estoque.\n3. **Execução:** O sistema informará a metragem e quantidade de peças do pedido.\n4. **Balança & Foto:** Ao concluir, registre o peso na balança e tire a foto para validação de qualidade (ou use o bypass de *Pular Foto* se autorizado pelo Encarregado).\n\n> 💡 **Alerta:** Em caso de divergência de peso superior a 3% ou falta de insumo, chame o **Encarregado de Produção** para liberar a ordem.`;
    }

    // 5. Cálculo de Peso & Aço
    if (text.includes("calcular") || text.includes("peso") || text.includes("tp-40") || text.includes("tp-25") || text.includes("fórmula") || text.includes("densidade") || text.includes("desenvolvimento")) {
      return `### 🧮 Cálculo Técnico de Peso para Aços Planos & Telhas\n\nA fórmula padrão usada na **AJL Ferro & Aço** para calcular o peso teórico é:\n\n$$\\text{Peso (kg)} = \\text{Metros} \\times \\text{Largura do Desenvolvimento (m)} \\times \\text{Espessura (mm)} \\times 7.85$$\n\n**Exemplo Prático (Telha TP-40 0.43mm):**\n- Desenvolvimento da chapa: **1,20m**\n- Espessura nominal: **0.43mm**\n- Peso por metro linear: **~4.05 kg/m**\n- Para uma telha de 6.00m: **~24.30 kg por peça**.`;
    }

    // 6. Hora Extra & Ponto
    if (text.includes("hora extra") || text.includes("ponto") || text.includes("jornada") || text.includes("escala") || text.includes("expediente")) {
      return `### 🕒 Integração com o App de Hora Extra AJL\n\n- **Plataforma Integrada:** O aplicativo mestre está em [\`hora-extra.base44.app\`](https://hora-extra.base44.app).\n- **Quem tem acesso:** Conforme as regras Odoo-style da AJL, o acesso ao lançamento e aprovação de horas extras é exclusivo para **Encarregados de Barracão** e **Administradores**.\n- **Acesso Rápido:** Você pode clicar no cartão **Hora Extra** na tela inicial ou no botão de perfil lateral!`;
    }

    // 7. Permissões, Regras e Bypasses
    if (text.includes("permissão") || text.includes("regras") || text.includes("bypass") || text.includes("balança") || text.includes("foto") || text.includes("admin") || text.includes("encarregado")) {
      return `### 🛡️ Permissões e Alçadas de Segurança Odoo-Style\n\nA **AJL Ferro & Aço** conta com um motor de **50+ regras operacionais** configuráveis:\n\n- **Administradores:** Acesso total a configurações, auditoria e usuários.\n- **Encarregados:** Autorizam bypasses de OP, alteração de fila de máquinas, pular foto da balança e aprovação de refugo > 3%.\n- **Operadores:** Operação das máquinas do seu turno.\n- **Vendedores:** Descontos e consulta de estoque em tempo real.`;
    }

    // 8. Logística, Frota & Expedição
    if (text.includes("logística") || text.includes("caminhão") || text.includes("romaneio") || text.includes("carga") || text.includes("frete") || text.includes("toco") || text.includes("truck") || text.includes("bitrem")) {
      return `### 🚚 Logística & Expedição de Cargas\n\n- **Capacidades Mapeadas:**\n  - **Toco:** Até 8.000 kg\n  - **Truck (6x2):** Até 14.000 kg\n  - **Bitrem:** Até 37.000 kg de carga útil.\n- **Procedimento:** Todo carregamento exige romaneio assinado e confirmação de peso na balança rodoviária antes da saída da fábrica.`;
    }

    // 9. Resposta Inteligente Adaptativa
    return `### 🤖 IA Assistente AJL Ferro & Aço\n\nCompreendi sua pergunta sobre **"${userText}"**!\n\nPara te ajudar de forma exata, posso consultar e te responder sobre qualquer um dos tópicos abaixo:\n\n1. 🎨 **Estoque de Bobinas Pintadas:** Cores (Grafite RAL 7016, Branco RAL 9003, Azul RAL 5010), espessuras (0.43mm/0.50mm) e quilos.\n2. ⚖️ **Saldos e Quilos de Bobinas:** Pesos exatos de bobinas cinzas ou pré-pintadas em estoque.\n3. 🏭 **Produção MES:** Lançamento de OPs, bypasses de balança e máquinas de Telhas/Corte e Dobra.\n4. 🧮 **Cálculos:** Pesos de telhas, consumo de chapa e metragem linear.\n5. 🕒 **Horas Extras:** Regras de lançamento no app integrados para Encarregados e Admins.\n\nDigite com mais detalhes o que você precisa verificar!`;
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
    }, 400);
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

      {/* Sheet Lateral no Meio Termo Perfeito (w-[650px]) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent 
          className="border-l border-border bg-slate-950 text-slate-100 flex flex-col p-0 shadow-2xl transition-all duration-300 w-full sm:w-[650px] max-w-none sm:max-w-none"
        >
          
          {/* Header da IA */}
          <SheetHeader className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-white flex items-center gap-2">
                  IA AJL Copilot
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] py-0 font-mono">v4.0 Pro</Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  Assistente Mestre de Operações, Bobinas & Engenharia
                </SheetDescription>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </SheetHeader>

          {/* Área de Mensagens (Meio Termo Elegante) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex gap-3 max-w-[96%] text-xs sm:text-sm leading-relaxed animate-in fade-in duration-200",
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
                  "p-3.5 sm:p-4 rounded-2xl space-y-2 border shadow-md w-full",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground border-primary/50 rounded-tr-none max-w-md"
                    : "bg-slate-900 text-slate-100 border-slate-800 rounded-tl-none"
                )}>
                  <div className="whitespace-pre-wrap font-sans overflow-x-auto">
                    {msg.text.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) {
                        return <h3 key={i} className="font-bold text-sm sm:text-base text-purple-300 mt-2 mb-1">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('> ')) {
                        return <blockquote key={i} className="border-l-3 border-purple-500 pl-2.5 italic text-purple-200 bg-purple-950/30 py-1.5 rounded-r-md my-1.5">{line.replace('> ', '')}</blockquote>;
                      }
                      return <p key={i} className="my-0.5 text-slate-200">{line}</p>;
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
                <span>IA AJL está consultando estoque e gerando resposta...</span>
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
                className="whitespace-nowrap text-[11px] bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-purple-600 transition-all shrink-0 cursor-pointer font-medium"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Input de Mensagem */}
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <Input 
              placeholder="Pergunte sobre bobinas pintadas, saldos em kg, OPs ou horas extras..." 
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
              <span>Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>

        </SheetContent>
      </Sheet>
    </>
  );
}
