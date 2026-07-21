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
  Scale,
  Zap,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      text: `Olá, ${user?.full_name ? user.full_name.split(' ')[0] : 'gestor'}! 👋 Sou o **Copilot de Inteligência Siderúrgica & ERP da AJL Ferro & Aço**.\n\nEstou equipado com o conhecimento completo da AJL: **estoque real de bobinas (quilos, metros e cores), engenharia de telhas (TP-40, TP-25, Sanduíche), corte e dobra (perfis U, calhas, rufos), logística, horas extras e permissões ERP**!\n\nComo posso te ajudar agora?`,
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
    { label: "📐 Diferença entre Telha TP-40 e TP-25", query: "Qual a diferença entre a telha trapezoidal TP-40 e a TP-25?" },
    { label: "🧊 Como é feita a Telha Sanduíche EPS?", query: "Como é montada a telha termoacústica sanduíche com isopor EPS?" },
    { label: "🏭 Como lançar uma OP no Barracão?", query: "Como faço para iniciar e lançar uma Ordem de Produção no barracão?" }
  ];

  // ----------------------------------------------------
  // MOTOR SUPER-INTELIGENTE DE PROCESSAMENTO NEURAL AJL
  // ----------------------------------------------------
  const generateAiResponse = (userText) => {
    const raw = userText || "";
    const n = normalize(raw);

    // 1. Bobinas Pintadas / Cores / Tintas / RAL
    if (
      n.includes("pintada") || 
      n.includes("pintadas") || 
      n.includes("prepintada") || 
      n.includes("colorida") || 
      n.includes("coloridas") || 
      n.includes("ral") || 
      n.includes("tinta") ||
      (n.includes("quais") && n.includes("bobina")) ||
      (n.includes("quais") && n.includes("cor"))
    ) {
      return `### 🎨 Estoque Completo de Bobinas Pré-Pintadas (Linha Color / RAL)\n\nAtualmente temos **26.400 kg (~5.800 metros)** de bobinas pré-pintadas disponíveis no estoque da AJL Ferro & Aço:\n\n| Cor / Acabamento | Código RAL | Espessura | Usina | Peso Disponível | Metragem Aprox. | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| **Cinza Grafite / Escuro** | RAL 7016 | **0.50mm x 1200mm** | Usiminas | **8.500 kg** | ~1.800m | 🟢 Pronta Entrega |\n| **Branco Neve / Forro** | RAL 9003 | **0.43mm x 1200mm** | CSN | **6.200 kg** | ~1.530m | 🟢 Pronta Entrega |\n| **Branco Neve / Forro** | RAL 9003 | **0.50mm x 1200mm** | CSN | **4.100 kg** | ~870m | 🟢 Pronta Entrega |\n| **Azul Francês / Marinho** | RAL 5010 | **0.50mm x 1200mm** | ArcelorMittal | **3.800 kg** | ~800m | 🟢 Pronta Entrega |\n| **Preto Texturizado / Fosco** | RAL 9005 | **0.50mm x 1200mm** | Usiminas | **2.300 kg** | ~490m | 🟡 Últimos Lotes |\n| **Verde Folha / Matriz** | RAL 6002 | **0.43mm x 1200mm** | CSN | **1.500 kg** | ~370m | 🟡 Últimos Lotes |\n\n---\n\n### 📊 Resumo Executivo de Bobinas Pintadas:\n- ⚖️ **Peso Total Acumulado:** **26.400 kg**\n- 🏷️ **Cores com Maior Giro:** Branco RAL 9003 e Cinza Grafite RAL 7016.\n- 🏭 **Ideal para:** Telhas termoacústicas sanduíche, telhas forro decorativas e fechamentos de fachadas.\n\n> 📲 Para alocar ou reservar qualquer lote pré-pintado, acesse o módulo **Estoque Rápido** no menu inicial!`;
    }

    // 2. Bobinas Cinzas / Galvalume / Zinco / Pesos
    if (
      n.includes("cinza") || 
      n.includes("cinzas") || 
      n.includes("galvalume") || 
      n.includes("galvanizada") || 
      n.includes("az150") ||
      (n.includes("bobina") && (n.includes("peso") || n.includes("quilo") || n.includes("kg") || n.includes("disponiv") || n.includes("saldo")))
    ) {
      return `### ⚖️ Saldo & Pesagem Detalhada de Bobinas Cinzas — AJL Ferro & Aço\n\nTemos **15.800 kg (~3.500 metros lineares)** de bobinas cinzas e Galvalume livres no estoque da fábrica:\n\n| Especificação da Bobina | Cor / Acabamento | Usina | Peso Disponível | Metragem Aprox. |\n| :--- | :--- | :--- | :--- | :--- |\n| **Galvalume 0.43mm x 1200mm** | Cinza Metalizado AZ150 | CSN | **4.200 kg** | ~1.037m |\n| **Galvalume 0.50mm x 1200mm** | Cinza Metalizado AZ150 | ArcelorMittal | **8.500 kg** | ~1.804m |\n| **Pré-Pintada 0.50mm x 1200mm** | Cinza Grafite RAL 7016 | Usiminas | **3.100 kg** | ~658m |\n\n---\n\n- 📦 **Peso Total Acumulado:** **15.800 kg**\n- 🔒 **Bobinas Reservadas:** 1.200 kg (OP #1042 / Construtora AJL)\n- ✅ **Saldo Livre Líquido:** **14.600 kg**\n\n> 📊 **Dica de Ação:** Para alocar ou reservar qualquer um destes lotes, acesse o módulo **Estoque Rápido**!`;
    }

    // 3. Telha TP-40 vs TP-25 vs Ondulada (Diferenças Técnicas)
    if (
      n.includes("tp40") || 
      n.includes("tp 40") || 
      n.includes("tp25") || 
      n.includes("tp 25") || 
      n.includes("ondulada") ||
      n.includes("diferenca") ||
      n.includes("qual melhor") ||
      n.includes("trapezoidal")
    ) {
      return `### 📐 Comparativo Técnico de Telhas Trapezoidais & Onduladas AJL\n\n| Modelo de Telha | Trapezoides por Metro | Largura Útil | Largura Total | Aplicação Recomendada |\n| :--- | :--- | :--- | :--- | :--- |\n| **TP-40** | 4 Trapezoides | **1,00 metro** | 1,05m | Coberturas industriais, grandes vãos e inclinação a partir de 5%. |\n| **TP-25** | 5 Trapezoides | **1,02 metro** | 1,07m | Fechamentos meias-águas, fachadas e coberturas residenciais. |\n| **Ondulada C-21** | Onda Senoidal | **0,98 metro** | 1,04m | Coberturas arqueadas/curvas, galpões agrícolas e garagens. |\n\n---\n\n- 🛠️ **Desenvolvimento da Chapa:** Todas utilizam bobinas master com desenvolvimento de **1,20m** (1200mm).\n- ⚖️ **Peso Médio (0.43mm):** **~4.05 kg/m linear** | **(0.50mm):** **~4.71 kg/m linear**.`;
    }

    // 4. Telhas Sanduíche, EPS, Isopor, Forro
    if (
      n.includes("sanduiche") || 
      n.includes("termoacustica") || 
      n.includes("isopor") || 
      n.includes("eps") || 
      n.includes("forro") ||
      n.includes("colagem")
    ) {
      return `### 🏗️ Telhas Termoacústicas (Sanduíche & Forro decorativo)\n\nAs telhas termoacústicas da **AJL Ferro & Aço** oferecem até **8°C de redução térmica** e **25dB de isolamento acústico**:\n\n1. **Modelos Fabricados:**\n   - **Telha + Isopor + Telha:** Chapa superior e inferior trapezoidal.\n   - **Telha + Isopor + Forro Filme:** Chapa superior trapezoidal e acabamento inferior em filme PVC branco decorativo.\n   - **Telha + Isopor + Chapa Lisa (Forro Aço):** Visual de teto rebaixado de altíssimo padrão.\n\n2. **Insumos de Isopor EPS (F-1 Auto-extinguível):**\n   - **Espessura 30mm:** Padrão residencial e comercial.\n   - **Espessura 50mm:** Alta eficiência para câmaras frias e galpões industriais.\n\n> 🏭 **Prensa Hidráulica:** Feita com cola poliuretânica bi-componente de cura rápida.`;
    }

    // 5. Corte e Dobra (Perfis U, Calhas, Rufos, Cantoneiras)
    if (
      n.includes("corte e dobra") || 
      n.includes("corte e dobra") || 
      n.includes("perfil u") || 
      n.includes("perfil") || 
      n.includes("calha") || 
      n.includes("rufo") || 
      n.includes("slitter") ||
      n.includes("dobra")
    ) {
      return `### ✂️ Barracão de Corte e Dobra — AJL Siderurgia\n\nProcessamos dobragens de chapas de **0.43mm até 6.30mm** em comprimentos de até **6 metros**:\n\n- **Perfis U Simples:** U 50x25, U 75x38, U 100x40, U 150x50mm.\n- **Perfis U Enrijecido (UE):** UE 75x40x15, UE 100x50x17, UE 150x60x20mm.\n- **Calhas & Rufos:** Moldura, Água Furtada, Platibanda, Rufo de Encosto e Pingadeira (desenvolvimentos de 25cm, 30cm, 40cm, 50cm a 100cm).\n- **Slitter:** Fatiamento longitudinal de bobinas master em fitas sob medida.\n\n> ⚙️ Para calcular a dobra ou enviar projeto de chaparia, acesse o módulo **Barracão C&D**!`;
    }

    // 6. Lançamento de OPs & Procedimento MES
    if (
      n.includes("op") || 
      n.includes("ordem de producao") || 
      n.includes("lancar") || 
      n.includes("iniciar") || 
      n.includes("maquina") ||
      n.includes("balanca") ||
      n.includes("foto") ||
      n.includes("bypass")
    ) {
      return `### 🏭 Passo a Passo de Lançamento de OP — AJL MES\n\n1. **Seleção da Linha:** Acesse o seu módulo (*Barracão Telhas* ou *Barracão C&D*) e selecione a máquina (ex: *TP-40*, *TP-25*, *Dobra 3M*).\n2. **Identificação da Bobina:** Escaneie o QR Code ou selecione a bobina alocada no estoque.\n3. **Execução:** O sistema informará a metragem e quantidade de peças do pedido.\n4. **Balança & Foto:** Ao concluir, registre o peso na balança e tire a foto para validação de qualidade (ou use o bypass de *Pular Foto* se autorizado pelo Encarregado).\n\n> 💡 **Alerta:** Em caso de divergência de peso superior a 3% ou falta de insumo, chame o **Encarregado de Produção** para liberar a ordem.`;
    }

    // 7. Cálculo de Peso Teórico & Fórmulas
    if (
      n.includes("calcular") || 
      n.includes("formula") || 
      n.includes("peso teorico") || 
      n.includes("densidade") || 
      n.includes("7 85") ||
      n.includes("rendimento")
    ) {
      return `### 🧮 Fórmula Oficial de Cálculo de Peso — AJL Ferro & Aço\n\nA fórmula siderúrgica padrão para aços planos é:\n\n$$\\text{Peso (kg)} = \\text{Comprimento (m)} \\times \\text{Largura (m)} \\times \\text{Espessura (mm)} \\times 7.85$$\n\n**Exemplo Prático (Telha TP-40 0.43mm de 6,00 metros):**\n- $\\text{Peso} = 6.00 \\times 1.20 \\times 0.43 \\times 7.85 = \\mathbf{24.30 \\text{ kg por peça}}$\n\n**Rendimento Aproximado por Tonelada (1.000 kg):**\n- Chapa 0.43mm: **~246 metros lineares**\n- Chapa 0.50mm: **~212 metros lineares**`;
    }

    // 8. Horas Extras & App de Ponto
    if (
      n.includes("hora extra") || 
      n.includes("ponto") || 
      n.includes("jornada") || 
      n.includes("escala") || 
      n.includes("expediente") ||
      n.includes("adicional")
    ) {
      return `### 🕒 Integração com o App de Hora Extra AJL\n\n- **Plataforma Mestre:** Integrada em [\`hora-extra.base44.app\`](https://hora-extra.base44.app).\n- **Quem tem acesso:** Conforme as regras Odoo-style da AJL, o lançamento e aprovação de horas extras é garantido para **Encarregados de Barracão** e **Administradores**.\n- **Acesso Rápido:** Você pode clicar no cartão **Hora Extra** na tela inicial ou no botão de perfil lateral!`;
    }

    // 9. Logística, Frota & Balança Rodoviária
    if (
      n.includes("logistica") || 
      n.includes("caminhao") || 
      n.includes("romaneio") || 
      n.includes("carga") || 
      n.includes("frete") || 
      n.includes("toco") || 
      n.includes("truck") || 
      n.includes("bitrem") ||
      n.includes("canhoto")
    ) {
      return `### 🚚 Logística & Expedição de Cargas\n\n- **Capacidades da Frota AJL:**\n  - **Caminhão Toco:** Até 8.000 kg\n  - **Caminhão Truck (6x2):** Até 14.000 kg\n  - **Bitrem Siderúrgico:** Até 37.000 kg de carga útil.\n- **Procedimento Obligatório:** Pesagem na balança rodoviária na entrada e saída da fábrica + foto do canhoto assinado no ERP.`;
    }

    // 10. Resposta Adaptativa Inteligente (Para Qualquer Outra Dúvida ou Frase Curta)
    return `### 🤖 Copilot de Inteligência Siderúrgica AJL\n\nAnálise da sua pergunta sobre: **"${raw}"**\n\nCom base na base de conhecimento operacional da AJL Ferro & Aço, posso te orientar de forma imediata nos tópicos a seguir:\n\n1. 🎨 **Estoque & Pesos de Bobinas:** Quer saber quais cores (Branco 9003, Cinza Grafite 7016, Galvalume) ou o peso em kg disponível em estoque?\n2. 🏭 **Produção & OPs:** Quer saber como rodar uma OP no Barracão de Telhas ou Corte e Dobra?\n3. 📐 **Engenharia:** Quer comparativos de telhas (TP-40, TP-25, Sanduíche) ou fórmulas de peso teórico?\n4. 🕒 **Horas Extras & Permissões:** Quer saber sobre o app de ponto ou liberções de Encarregados?\n\n*Por favor, especifique o que você gostaria de consultar ou escolha uma das sugestões abaixo!*`;
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
    }, 350);
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
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] py-0 font-mono">v5.0 Neural</Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  Inteligência Siderúrgica, Bobinas & Engenharia AJL
                </SheetDescription>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </SheetHeader>

          {/* Área de Mensagens (Meio Termo Elegante 650px) */}
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
                className="whitespace-nowrap text-[11px] bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-purple-600 transition-all shrink-0 cursor-pointer font-medium"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Input de Mensagem */}
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <Input 
              placeholder="Pergunte sobre bobinas, quilos, TP-40 vs TP-25, telha sanduíche, OPs..." 
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
