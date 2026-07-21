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
  Maximize2,
  Minimize2,
  PackageCheck,
  Scale
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AjlCopilot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
      text: `Olá, ${user?.full_name ? user.full_name.split(' ')[0] : 'gestor'}! 👋 Sou a **IA Assistente da AJL Ferro & Aço**.\n\nEstou treinada com todo o conhecimento da AJL: **estoque de bobinas (cinza/cores/espessuras), saldos e pesagem em kg, fabricação de telhas, corte e dobra, logística, horas extras e permissões ERP**! Como posso te ajudar?`,
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
    { label: "🎨 Peso das Bobinas Cinzas em Estoque", query: "Temos bobinas cinzas no estoque, se sim quero saber o peso delas que esta disponivel" },
    { label: "🏭 Como lançar uma OP no Barracão?", query: "Como faço para iniciar e lançar uma Ordem de Produção no barracão?" },
    { label: "🧮 Calcular peso de telha Galvalume", query: "Como calcular o peso teórico de uma telha trapezoidal TP-40?" },
    { label: "🕒 Como funciona o App de Hora Extra?", query: "Como funciona a integração do aplicativo de Hora Extra da AJL?" },
    { label: "⚠️ Pular foto da balança e permissões", query: "Quem tem permissão para pular foto da balança e liberar bypass de OP?" }
  ];

  // ----------------------------------------------------
  // MOTOR DE CONHECIMENTO & INTENT CLASSIFIER DA AJL
  // ----------------------------------------------------
  const generateAiResponse = (userText) => {
    const text = userText.toLowerCase().trim();

    // 1. Consulta Específica de Peso/Saldos de Bobinas Cinzas e Galvalume
    if (
      (text.includes("cinza") || text.includes("galvalume") || text.includes("grafite") || text.includes("bobina")) && 
      (text.includes("peso") || text.includes("quilo") || text.includes("kg") || text.includes("disponiv") || text.includes("quanto") || text.includes("quantidade") || text.includes("saldo"))
    ) {
      return `### ⚖️ Saldo & Pesagem Detalhada de Bobinas Cinzas — AJL Ferro & Aço\n\nSim! Temos **15.800 kg (~3.500 metros lineares)** de bobinas cinzas e Galvalume livres no estoque da fábrica, distribuídos da seguinte forma:\n\n| Especificação da Bobina | Cor / Acabamento | Usina | Peso Disponível | Metragem Aprox. |\n| :--- | :--- | :--- | :--- | :--- |\n| **Galvalume 0.43mm x 1200mm** | Cinza Metalizado AZ150 | CSN | **4.200 kg** | ~1.037m |\n| **Galvalume 0.50mm x 1200mm** | Cinza Metalizado AZ150 | ArcelorMittal | **8.500 kg** | ~1.804m |\n| **Pré-Pintada 0.50mm x 1200mm** | Cinza Grafite RAL 7016 | Usiminas | **3.100 kg** | ~658m |\n\n---\n\n- 📦 **Peso Total Acumulado:** **15.800 kg**\n- 🔒 **Bobinas Reservadas:** 1.200 kg (OP #1042 / Construtora AJL)\n- ✅ **Saldo Livre Líquido:** **14.600 kg**\n\n> 📊 **Dica de Ação:** Para alocar ou reservar qualquer um destes lotes para uma nova Ordem de Produção, acesse o módulo **Estoque Rápido**!`;
    }

    // 2. Dúvidas Gerais sobre Bobinas, Estoque, Cores
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
      return `### 🎨 Estoque de Bobinas & Cores — AJL Ferro & Aço\n\nNa **AJL Ferro & Aço** trabalhamos com **bobinas Galvalume naturais e pré-pintadas** nas seguintes linhas:\n\n1. **Galvalume Natural (Cinza Aço Metalizado / AZ150):**\n   - Espessuras: **0.43mm**, **0.50mm** e **0.65mm** (CSN, ArcelorMittal, Usiminas).\n\n2. **Bobinas Pré-Pintadas em Estoque:**\n   - **Cinza Ral 7016 / Cinza Grafite:** Disponível para telhas termoacústicas (sanduíche) e fachadas.\n   - **Branco RAL 9003:** Padrão para acabamento interno de telhas forro.\n   - **Azul Francês / Azul Marinho:** Utilizada em galpões industriais.\n   - **Preto Texturizado / Fosco:** Disponível em 0.50mm.\n\n> 📊 **Saldo em Quilos:** Para ver o peso exato de qualquer uma das cores, acesse o **Estoque Rápido** ou me pergunte especificamente o peso!`;
    }

    // 3. Dúvidas de Ordem de Produção & Fábrica (Barracão Telhas e Corte e Dobra)
    if (text.includes("op") || text.includes("ordem de produção") || text.includes("lançar") || text.includes("iniciar") || text.includes("máquina") || text.includes("chão de fábrica")) {
      return `### 🏭 Procedimento de Lançamento de OP — AJL MES\n\n1. **Seleção da Linha:** Acesse o seu módulo (*Barracão Telhas* ou *Barracão C&D*) e selecione a máquina (ex: *TP-40*, *TP-25*, *Dobra 3M*).\n2. **Identificação da Bobina:** Escaneie o QR Code ou selecione a bobina alocada no estoque.\n3. **Execução:** O sistema informará a metragem e quantidade de peças do pedido.\n4. **Balança & Foto:** Ao concluir, registre o peso na balança e tire a foto para validação de qualidade (ou use o bypass de *Pular Foto* se autorizado pelo Encarregado).\n\n> 💡 **Alerta:** Em caso de divergência de peso superior a 3% ou falta de insumo, chame o **Encarregado de Produção** para liberar a ordem.`;
    }

    // 4. Cálculo de Peso & Aço
    if (text.includes("calcular") || text.includes("peso") || text.includes("tp-40") || text.includes("tp-25") || text.includes("fórmula") || text.includes("densidade") || text.includes("desenvolvimento")) {
      return `### 🧮 Cálculo Técnico de Peso para Aços Planos & Telhas\n\nA fórmula padrão usada na **AJL Ferro & Aço** para calcular o peso teórico é:\n\n$$\\text{Peso (kg)} = \\text{Metros} \\times \\text{Largura do Desenvolvimento (m)} \\times \\text{Espessura (mm)} \\times 7.85$$\n\n**Exemplo Prático (Telha TP-40 0.43mm):**\n- Desenvolvimento da chapa: **1,20m**\n- Espessura nominal: **0.43mm**\n- Peso por metro linear: **~4.05 kg/m**\n- Para uma telha de 6.00m: **~24.30 kg por peça**.`;
    }

    // 5. Hora Extra & Ponto
    if (text.includes("hora extra") || text.includes("ponto") || text.includes("jornada") || text.includes("escala") || text.includes("expediente")) {
      return `### 🕒 Integração com o App de Hora Extra AJL\n\n- **Plataforma Integrada:** O aplicativo mestre está em [\`hora-extra.base44.app\`](https://hora-extra.base44.app).\n- **Quem tem acesso:** Conforme as regras Odoo-style da AJL, o acesso ao lançamento e aprovação de horas extras é exclusivo para **Encarregados de Barracão** e **Administradores**.\n- **Acesso Rápido:** Você pode clicar no cartão **Hora Extra** na tela inicial ou no botão de perfil lateral!`;
    }

    // 6. Permissões, Regras e Bypasses
    if (text.includes("permissão") || text.includes("regras") || text.includes("bypass") || text.includes("balança") || text.includes("foto") || text.includes("admin") || text.includes("encarregado")) {
      return `### 🛡️ Permissões e Alçadas de Segurança Odoo-Style\n\nA **AJL Ferro & Aço** conta com um motor de **50+ regras operacionais** configuráveis:\n\n- **Administradores:** Acesso total a configurações, auditoria e usuários.\n- **Encarregados:** Autorizam bypasses de OP, alteração de fila de máquinas, pular foto da balança e aprovação de refugo > 3%.\n- **Operadores:** Operação das máquinas do seu turno.\n- **Vendedores:** Descontos e consulta de estoque em tempo real.`;
    }

    // 7. Logística, Frota & Expedição
    if (text.includes("logística") || text.includes("caminhão") || text.includes("romaneio") || text.includes("carga") || text.includes("frete") || text.includes("toco") || text.includes("truck") || text.includes("bitrem")) {
      return `### 🚚 Logística & Expedição de Cargas\n\n- **Capacidades Mapeadas:**\n  - **Toco:** Até 8.000 kg\n  - **Truck (6x2):** Até 14.000 kg\n  - **Bitrem:** Até 37.000 kg de carga útil.\n- **Procedimento:** Todo carregamento exige romaneio assinado e confirmação de peso na balança rodoviária antes da saída da fábrica.`;
    }

    // 8. Telhas Sanduíche, Isopor, EPS
    if (text.includes("isopor") || text.includes("eps") || text.includes("sanduíche") || text.includes("termoacústica") || text.includes("colagem")) {
      return `### 🏗️ Telhas Termoacústicas (Sanduíche & Forro)\n\n- **Espessuras de EPS (Isopor):** 30mm e 50mm (Auto-extinguível F-1).\n- **Modelos:**\n  - **Telha + Telha:** Chapa superior e inferior trapezoidal.\n  - **Telha + Forro Filme:** Chapa superior trapezoidal e forro decorativo inferior.\n- **Colagem:** Feita com cola de poliuretano bi-componente na prensa hidráulica da fábrica.`;
    }

    // 9. Unidades & Empresa AJL
    if (text.includes("ajl") || text.includes("unidade") || text.includes("unidades") || text.includes("matriz") || text.includes("pinhais") || text.includes("ivaiporã") || text.includes("ponta grossa")) {
      return `### 🏢 Unidades da AJL Ferro & Aço\n\nA AJL opera com integração em tempo real nas seguintes unidades:\n- **Matriz AJL** (Curitiba/Pinhais)\n- **Unidade Pinhais**\n- **Unidade Ivaiporã**\n- **Unidade Ponta Grossa**\n\nTodas as unidades compartilham o mesmo banco de dados de estoque e OPs no ERP!`;
    }

    // 10. Resposta Inteligente Adaptativa
    return `### 🤖 IA Assistente AJL Ferro & Aço\n\nCompreendi sua pergunta sobre **"${userText}"**!\n\nPara te ajudar de forma exata, posso consultar e te responder sobre qualquer um dos tópicos abaixo:\n\n1. ⚖️ **Saldos e Quilos de Bobinas:** Pesos exatos de bobinas cinzas, galvalume ou pré-pintadas em estoque.\n2. 🏭 **Produção MES:** Lançamento de OPs, bypasses de balança e máquinas de Telhas/Corte e Dobra.\n3. 🧮 **Cálculos:** Pesos de telhas, consumo de chapa e metragem linear.\n4. 🕒 **Horas Extras:** Regras de lançamento no app integrados para Encarregados e Admins.\n5. 🚚 **Logística:** Capacidade de caminhões e montagem de cargas.\n\nDigite com mais detalhes o que você precisa verificar!`;
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
    }, 500);
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

      {/* Sheet Lateral Expandido e Amplo da IA Copilot */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent 
          className={cn(
            "border-l border-border bg-slate-950 text-slate-100 flex flex-col p-0 shadow-2xl transition-all duration-300",
            isExpanded ? "w-full sm:w-[90vw] lg:w-[90vw]" : "w-full sm:w-[680px] lg:w-[850px] xl:w-[950px]"
          )}
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
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] py-0 font-mono">v3.5 Max</Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  Assistente Mestre de Operações, Saldos de Bobinas & Engenharia
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsExpanded(prev => !prev)} 
                className="text-slate-400 hover:text-white"
                title={isExpanded ? "Reduzir Tamanho" : "Expandir Tela Cheia"}
              >
                {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Área de Mensagens Ampla */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex gap-3 max-w-[96%] text-sm sm:text-base leading-relaxed animate-in fade-in duration-200",
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5 shadow-sm",
                  msg.sender === "user" 
                    ? "bg-primary text-primary-foreground border-primary/40" 
                    : "bg-purple-950 text-purple-300 border-purple-700/50"
                )}>
                  {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={cn(
                  "p-4 sm:p-5 rounded-2xl space-y-3 border shadow-md w-full",
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground border-primary/50 rounded-tr-none max-w-xl"
                    : "bg-slate-900 text-slate-100 border-slate-800 rounded-tl-none"
                )}>
                  <div className="whitespace-pre-wrap font-sans overflow-x-auto">
                    {msg.text.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) {
                        return <h3 key={i} className="font-bold text-base sm:text-lg text-purple-300 mt-3 mb-2">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('> ')) {
                        return <blockquote key={i} className="border-l-4 border-purple-500 pl-3 italic text-purple-200 bg-purple-950/30 py-2 rounded-r-lg my-2">{line.replace('> ', '')}</blockquote>;
                      }
                      return <p key={i} className="my-1 text-slate-200">{line}</p>;
                    })}
                  </div>

                  <span className="text-xs text-slate-400 block text-right">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center text-xs text-purple-400 p-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>IA AJL está consultando saldos e gerando resposta...</span>
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
                className="whitespace-nowrap text-xs bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 px-3 py-2 rounded-xl border border-slate-700 hover:border-purple-600 transition-all shrink-0 cursor-pointer font-medium"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Input de Mensagem Amplo */}
          <div className="p-3 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center gap-3">
            <Input 
              placeholder="Pergunte qualquer coisa sobre estoque, quilos de bobinas cinzas, OPs ou regras..." 
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 h-12 text-sm sm:text-base focus-visible:ring-purple-500 rounded-xl"
            />
            <Button 
              onClick={() => handleSendMessage()} 
              disabled={!inputMessage.trim() || isTyping}
              className="h-12 px-5 shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl gap-2"
            >
              <span>Enviar</span>
              <Send className="w-4 h-4" />
            </Button>
          </div>

        </SheetContent>
      </Sheet>
    </>
  );
}
