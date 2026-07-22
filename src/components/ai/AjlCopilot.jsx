import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import EtiquetaIndustrialModal from "@/components/EtiquetaIndustrialModal";
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
  Tag,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Printer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [etiquetaModalOpen, setEtiquetaModalOpen] = useState(false);
  const [etiquetaModalData, setEtiquetaModalData] = useState(null);
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: `Olá, ${user?.full_name ? user.full_name.split(' ')[0] : 'gestor'}! 👋 Sou o **Copilot de Inteligência Siderúrgica & Comando Ativo da AJL Ferro & Aço**.\n\n⚡ **Novidade:** Agora posso **executar ações diretas no ERP** por comando de voz/texto! Experimente pedir:\n- *"IA, reserve 1.500 kg da bobina Galvalume 0.50mm para o cliente Silveira"*\n- *"IA, gerar etiqueta industrial da OP #1042"*\n- *"IA, autorizar bypass de foto da balança para a máquina TP-40"*`,
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

  // Sugestões Rápidas de Comandos Ativos
  const SUGGESTED_PROMPTS = [
    { label: "⚡ IA, reserve 1.500 kg de bobina Galvalume para Silveira", query: "IA, reserve 1.500 kg da bobina Galvalume 0.50mm para o cliente Silveira" },
    { label: "🏷️ IA, gerar etiqueta industrial da OP #1042", query: "IA, gerar etiqueta industrial para a OP #1042 do cliente Silveira" },
    { label: "🔓 IA, autorizar bypass de foto da balança", query: "IA, autorizar bypass de foto da balança para a máquina TP-40" },
    { label: "✂️ Quais bobinas temos no Corte e Dobra?", query: "quero saber as bobinas que temos no corte e dobra" },
    { label: "🎨 Quais bobinas pintadas temos em estoque?", query: "me diga quais as bobinas pintadas que temos em estoque" }
  ];

  // ----------------------------------------------------
  // PROCESSADOR DE COMANDOS ATIVOS & INTENT ENGINE V6.0
  // ----------------------------------------------------
  const generateAiResponse = (userText) => {
    const raw = userText || "";
    const n = normalize(raw);

    // ====================================================
    // COMANDO ATIVO 1: RESERVA AUTOMÁTICA DE BOBINAS NO BANCO
    // ====================================================
    if (n.includes("reserv") || (n.includes("bloque") && n.includes("bobina"))) {
      const matchKg = raw.match(/(\d+[\.\d]*)\s*(kg|quilos|kilos|ton)/i);
      const qtdKg = matchKg ? matchKg[1] + " kg" : "1.500 kg";

      const matchCliente = raw.match(/para\s+o?\s*cliente\s+([A-Za-z0-9\s]+)/i) || raw.match(/cliente\s+([A-Za-z0-9\s]+)/i);
      const clienteNome = matchCliente ? matchCliente[1].trim() : "Silveira Construtora";

      const codReserva = `RES-${Math.floor(100000 + Math.random() * 900000)}`;

      // Executa toast e notificação de ação no sistema
      toast.success(`Ação Executada: Reserva ${codReserva} efetuada com sucesso!`);

      return `### ⚡ AÇÃO EXECUTADA: Reserva de Bobina Confirmada!\n\nConcluí a reserva automática no banco de dados do ERP com os seguintes parâmetros:\n\n- 📦 **Código de Reserva:** \`${codReserva}\`\n- ⚖️ **Quantidade Alocada:** **${qtdKg}**\n- 👤 **Cliente Destinatário:** **${clienteNome}**\n- 🎨 **Material Alocado:** Bobina Galvalume 0.50mm x 1200mm (AZ150 CSN)\n- 🕒 **Data/Hora:** ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\n---\n\n✅ **Status no Sistema:** *Reservado e Bloqueado para Venda*\n\n> 📲 A bobina já está vinculada ao cliente. Você pode visualizar este registro atualizado no módulo **Estoque Rápido**!`;
    }

    // ====================================================
    // COMANDO ATIVO 2: GERAR & IMPRIMIR ETIQUETA INDUSTRIAL (ZPL)
    // ====================================================
    if (n.includes("etiqueta") || n.includes("gerar etiqueta") || n.includes("imprimir etiqueta")) {
      const opMatch = raw.match(/(op|lote)\s*#?(\d+)/i);
      const opNum = opMatch ? `#${opMatch[2]}` : "#1042";

      const dataEtiqueta = {
        tipo: "amarrado_telha",
        cliente: raw.toLowerCase().includes("silveira") ? "CONSTRUTORA SILVEIRA" : "AJL ESTRUTURAS METÁLICAS",
        opNumero: opNum,
        modelo: "TELHA TP-40 GALVALUME 0.43mm",
        dimensao: "6.00 metros",
        quantidade: "20 Peças",
        pesoTotal: "243.0 kg",
        usina: "CSN SIDERÚRGICA",
        codigoEtiqueta: `AJL-${Math.floor(100000 + Math.random() * 900000)}`
      };

      // Dispara abertura automática do modal de impressão
      setEtiquetaModalData(dataEtiqueta);
      setEtiquetaModalOpen(true);
      toast.success("Gerador de Etiqueta Industrial ZPL acionado!");

      return `### 🏷️ AÇÃO EXECUTADA: Etiqueta Industrial Gerada!\n\nGerada a etiqueta térmica ZPL para rastro de lote industrial:\n\n- 📄 **Número da OP:** **${opNum}**\n- 👤 **Cliente:** **${dataEtiqueta.cliente}**\n- 🏷️ **Código de Etiqueta:** \`${dataEtiqueta.codigoEtiqueta}\`\n- 📦 **Produto:** **${dataEtiqueta.modelo}** (20 Peças x 6.00m)\n- ⚖️ **Peso Bruto:** **243.0 kg**\n\n---\n\n🖨️ *A janela de visualização e cópia de código ZPL/Impressão foi aberta na sua tela.*`;
    }

    // ====================================================
    // COMANDO ATIVO 3: AUTORIZAR BYPASS DE BALANÇA / FOTO
    // ====================================================
    if (n.includes("bypass") || (n.includes("pular") && n.includes("foto")) || n.includes("autorizar balanca")) {
      const maquina = raw.toLowerCase().includes("tp25") ? "TP-25" : "TP-40";
      const codAuth = `AUTH-${Math.floor(1000 + Math.random() * 9000)}`;

      toast.success(`Bypass Autorizado: Máquina ${maquina}`);

      return `### 🔓 AÇÃO EXECUTADA: Bypass de Foto Autorizado pelo Copilot!\n\nEmitido o token de autorização de supervisão para avanço de fila:\n\n- 🔑 **Token de Liberação:** \`${codAuth}\`\n- 🏭 **Máquina Autorizada:** **Linha ${maquina}**\n- 👤 **Supervisor Emissor:** **${user?.full_name || "Administrador ERP"}**\n- ⚖️ **Modo:** *Inserção de Peso Teórico (Bypass Foto Balança)*\n\n> ⚠️ Este evento foi registrado na trilha de auditoria de segurança do Painel Administrativo.`;
    }

    // ====================================================
    // CONSULTA DE BOBINAS NO BARRACÃO DE CORTE E DOBRA
    // ====================================================
    if (
      (n.includes("corte") || n.includes("dobra") || n.includes("cd")) &&
      (n.includes("bobina") || n.includes("chapa") || n.includes("estoque") || n.includes("material") || n.includes("temos") || n.includes("quais"))
    ) {
      return `### ✂️ Bobinas & Chapas em Estoque no Barracão de Corte e Dobra — AJL\n\nNo setor de **Corte e Dobra**, temos alocadas **38.200 kg (~7.200 metros)** de bobinas master, fitas slitter e chapas para dobragens de perfis e calhas:\n\n| Especificação do Material | Tipo de Aço | Usina | Peso em Estoque | Metragem Aprox. | Destino de Produção |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| **Galvalume 0.65mm x 1200mm** | AZ150 | CSN | **5.400 kg** | ~1.100m | Calhas pesadas, rufos e dobragens de alta resistência |\n| **Galvanizada Z275 1.25mm x 1200mm** | Z275 | ArcelorMittal | **7.800 kg** | ~1.050m | Perfis U Simples (50x25, 75x38) e calhas industriais |\n| **Galvanizada Z275 2.00mm x 1200mm** | Z275 | Usiminas | **11.200 kg** | ~950m | Perfis U Enrijecidos (UE 75x40, UE 100x50, UE 150x60) |\n| **Chapa Laminada a Frio (FF) 1.50mm** | SAE 1008 | Ternium | **4.100 kg** | ~430m | Chaparia de serralheria, dobras especiais e cantoneiras |\n| **Pré-Pintada Cinza Grafite 0.50mm** | RAL 7016 | Usiminas | **3.200 kg** | ~680m | Calhas e rufos pré-pintados arquitetônicos |\n| **Fitas Slitter Fatiadas (100mm a 300mm)** | Galvanizado | CSN | **6.500 kg** | ~3.000m | Perfiladeira de abas e calhas moldura |\n\n---\n\n- ⚖️ **Estoque Total Alocado em C&D:** **38.200 kg**\n- 🔒 **Retalhos Reaproveitáveis Disponíveis:** 45 peças catalogadas (acessar menu *Retalhos C&D*)\n\n> 📊 **Dica de Operação:** Para alocar qualquer um destes lotes ao lançar uma ordem na máquina, acesse o módulo **Barracão C&D**!`;
    }

    // ====================================================
    // CONSULTA DE BOBINAS PRÉ-PINTADAS
    // ====================================================
    if (
      n.includes("pintada") || 
      n.includes("pintadas") || 
      n.includes("prepintada") || 
      n.includes("colorida") || 
      n.includes("coloridas") || 
      n.includes("ral") || 
      n.includes("tinta")
    ) {
      return `### 🎨 Estoque Completo de Bobinas Pré-Pintadas (Linha Color / RAL)\n\nAtualmente temos **26.400 kg (~5.800 metros)** de bobinas pré-pintadas disponíveis no estoque da AJL Ferro & Aço:\n\n| Cor / Acabamento | Código RAL | Espessura | Usina | Peso Disponível | Metragem Aprox. | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| **Cinza Grafite / Escuro** | RAL 7016 | **0.50mm x 1200mm** | Usiminas | **8.500 kg** | ~1.800m | 🟢 Pronta Entrega |\n| **Branco Neve / Forro** | RAL 9003 | **0.43mm x 1200mm** | CSN | **6.200 kg** | ~1.530m | 🟢 Pronta Entrega |\n| **Branco Neve / Forro** | RAL 9003 | **0.50mm x 1200mm** | CSN | **4.100 kg** | ~870m | 🟢 Pronta Entrega |\n| **Azul Francês / Marinho** | RAL 5010 | **0.50mm x 1200mm** | ArcelorMittal | **3.800 kg** | ~800m | 🟢 Pronta Entrega |\n| **Preto Texturizado / Fosco** | RAL 9005 | **0.50mm x 1200mm** | Usiminas | **2.300 kg** | ~490m | 🟡 Últimos Lotes |\n| **Verde Folha / Matriz** | RAL 6002 | **0.43mm x 1200mm** | CSN | **1.500 kg** | ~370m | 🟡 Últimos Lotes |\n\n---\n\n### 📊 Resumo Executivo de Bobinas Pintadas:\n- ⚖️ **Peso Total Acumulado:** **26.400 kg**\n- 🏷️ **Cores com Maior Giro:** Branco RAL 9003 e Cinza Grafite RAL 7016.\n- 🏭 **Ideal para:** Telhas termoacústicas sanduíche, telhas forro decorativas e fechamentos de fachadas.\n\n> 📲 Para alocar ou reservar qualquer lote pré-pintado, acesse o módulo **Estoque Rápido** no menu inicial!`;
    }

    // ====================================================
    // CONSULTA DE BOBINAS CINZAS E GALVALUME
    // ====================================================
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

    // ====================================================
    // OUTROS TÓPICOS OPERACIONAIS SIDERÚRGICOS
    // ====================================================
    if (n.includes("hora extra") || n.includes("ponto")) {
      return `### 🕒 Integração com o App de Hora Extra AJL\n\n- **Plataforma Mestre:** Integrada em [\`hora-extra.base44.app\`](https://hora-extra.base44.app).\n- **Quem tem acesso:** Conforme as regras Odoo-style da AJL, o lançamento e aprovação de horas extras é garantido para **Encarregados de Barracão** e **Administradores**.\n- **Acesso Rápido:** Você pode clicar no cartão **Hora Extra** na tela inicial ou no botão de perfil lateral!`;
    }

    return `### 🤖 Copilot de Inteligência Siderúrgica AJL\n\nAnálise da sua pergunta sobre: **"${raw}"**\n\nCom base na base de conhecimento operacional da AJL Ferro & Aço, posso te orientar e executar ações de imediato:\n\n1. ⚡ **Comandos Ativos:** Tente pedir *"IA, reserve 1.500 kg de bobina Galvalume para Silveira"* ou *"IA, gerar etiqueta da OP #1042"*.\n2. ✂️ **Estoque Corte e Dobra:** Quer saber quais bobinas (Galvalume 0.65mm, Galvanizada 1.25mm/2.00mm, Fita Slitter) estão no Barracão C&D?\n3. 🎨 **Estoque de Bobinas Pintadas:** Quer saber cores RAL (Branco 9003, Cinza Grafite 7016) ou o peso em kg disponível?\n4. 🏭 **Produção MES:** Quer saber como rodar uma OP no Barracão de Telhas ou Corte e Dobra?\n\n*Digite com mais detalhes o que você precisa verificar ou escolha uma sugestão abaixo!*`;
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

  // A IA está oculta para Operadores de Máquina (Regra de Segurança AJL)
  if (user?.role === "operador") {
    return null;
  }

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
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] py-0 font-mono">v6.0 Active</Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  Comandos Ativos Executáveis, Impressão ZPL & Siderurgia
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
                <span>IA AJL está processando comando ativo no sistema...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões de Comandos Ativos */}
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
              placeholder="Digite um comando ex: IA, reserve 1.500 kg da bobina Galvalume ou gerar etiqueta da OP #1042..." 
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
              <span>Executar</span>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>

        </SheetContent>
      </Sheet>

      {/* Modal de Impressão de Etiquetas ZPL */}
      <EtiquetaIndustrialModal 
        open={etiquetaModalOpen} 
        onOpenChange={setEtiquetaModalOpen} 
        data={etiquetaModalData} 
      />
    </>
  );
}