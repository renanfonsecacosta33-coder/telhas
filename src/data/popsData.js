/**
 * Base de Dados Estruturada dos Procedimentos Operacionais Padrão (POPs) e Fluxogramas da AJL Ferro & Aço.
 * Usada pelo GuiaOperacionalModal (nas máquinas) e pela CentralPopsPage (no Hub Principal).
 */

export const POPS_DATA = {
  "TP - 40": {
    id: "POP-IND-01",
    titulo: "Perfiladeira TP-40 (Telhas Simples)",
    subtitulo: "Conformação contínua de telha trapezoidal 40/980 em Galvalume e Pré-Pintado",
    setor: "Barracão Telhas",
    setorKey: "telhas",
    maquinasCompativeis: ["TP - 40", "TP - 25", "ONDULADA", "COLONIAL", "CUMEEIRA"],
    equipePadrao: "2 Operadores (Líder no Painel + Ajudante no Fim de Linha)",
    capacidade: "Bobinas 0,43mm a 0,65mm · Largura 1200mm · Velocidade até 25 m/min",
    corBadge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
    corHeader: "from-emerald-600 to-teal-700",
    epis: [
      { nome: "Luva Anticorte Nível 5", norma: "NR-6", desc: "Manuseio de arestas vivas de aço e fardos" },
      { nome: "Mangote Anticorte HPPE", norma: "NR-6", desc: "Proteção dos antebraços na alimentação e empilhamento" },
      { nome: "Botina com Bico de Aço", norma: "NR-6", desc: "Proteção contra queda de ferramentas e peças" },
      { nome: "Óculos de Proteção Lateral", norma: "NR-6", desc: "Proteção ocular contra carepa e respingos de óleo" },
      { nome: "Capacete com Jugular", norma: "NR-11", desc: "Uso obrigatório na área de carga suspensa da ponte rolante" },
      { nome: "Protetor Auricular", norma: "NR-15", desc: "Atenuação de ruído da conformação contínua e guilhotina" }
    ],
    regrasSeguranca: [
      "NUNCA toque nos roletes de conformação enquanto a máquina estiver ligada em modo Automático.",
      "Para qualquer alinhamento ou limpeza de roletes, aperte a Botoeira de Emergência e use modo MANUAL/PULSO.",
      "Mantenha a proteção física da guilhotina hidráulica travada durante toda a operação.",
      "Içamento de bobinas: certifique-se de que a trava do gancho da ponte rolante esteja perfeitamente fechada."
    ],
    fluxo: [
      {
        passo: 1,
        titulo: "1. Consulta no Tablet",
        posto: "Tablet da Máquina",
        tipo: "processo",
        tempo: "2 min",
        desc: "Checar fila FIFO, prioridades ('Retira Agora' ou 'Rota'), espessura, cor e cliente da OP.",
        icone: "Tablet"
      },
      {
        passo: 2,
        titulo: "2. Içamento & Mandril",
        posto: "Ponte Rolante / Desbobinador",
        tipo: "processo",
        tempo: "8 min",
        desc: "Localizar bobina no estoque, içar com cinta/C-Hook, travar no mandril expansivo e cortar a fita.",
        icone: "Crane"
      },
      {
        passo: 3,
        titulo: "3. Início no Sistema",
        posto: "Tablet da Máquina",
        tipo: "processo",
        tempo: "1 min",
        desc: "Validar etiqueta da bobina e clicar em 'Iniciar Produção'. Cronômetro é ativado.",
        icone: "Play"
      },
      {
        passo: 4,
        titulo: "4. Corte de Esquadro & Teste",
        posto: "Guilhotina / Roletes",
        tipo: "inspecao",
        tempo: "3 min",
        desc: "Guiar fita no modo manual, refilar ponta torta e produzir 1 peça teste de 1.000 mm.",
        icone: "Scissors"
      },
      {
        passo: 5,
        titulo: "5. Inspeção Dimensional",
        posto: "Mesa de Saída",
        tipo: "decisao",
        tempo: "2 min",
        desc: "Medir comprimento (±2mm na trena), espessura (micrômetro digital) e largura útil de 980mm.",
        icone: "Ruler"
      },
      {
        passo: 6,
        titulo: "6. Produção Contínua",
        posto: "Perfiladeira em Automático",
        tipo: "processo",
        tempo: "15-40 min",
        desc: "Operador 1 monitora alimentação e CLP; Operador 2 recebe na mesa e empilha em fardos de até 50 peças.",
        icone: "Layers"
      },
      {
        passo: 7,
        titulo: "7. Amarração & Etiquetagem",
        posto: "Mesa de Roletes",
        tipo: "processo",
        tempo: "5 min",
        desc: "Passar no mínimo 3 fitas de arqueamento com cantoneiras de proteção e fixar etiqueta industrial.",
        icone: "PackageCheck"
      },
      {
        passo: 8,
        titulo: "8. Foto & Baixa Final",
        posto: "Tablet da Máquina",
        tipo: "finalizacao",
        tempo: "2 min",
        desc: "Tirar foto nítida do fardo pronto com a etiqueta, informar metros reais e clicar em 'Finalizar Pedido'.",
        icone: "Camera"
      }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Preparação & Içamento da Bobina",
        acaoFisica: "Localizar a bobina no estoque com a cor e espessura exigidas. Içar com a ponte rolante usando balancim ou cinta sintética. Centralizar no eixo do desbobinador e expandir o mandril até travamento firme. Travar o disco de contenção lateral e posicionar o braço pressor antes de cortar a fita metálica de arqueamento.",
        acaoTablet: "Conferir o número da OP na fila de produção da máquina. Se a bobina física for diferente do sugerido, utilizar a função de troca/ajuste de bobina para manter a rastreabilidade precisa do estoque.",
        criterioQualidade: "Bobina perfeitamente alinhada com as guias de entrada da perfiladeira (desvio angular zero)."
      },
      {
        numero: 2,
        titulo: "Validação & Início da OP no Sistema",
        acaoFisica: "Ligar a chave geral do painel elétrico da perfiladeira, checar nível de óleo da unidade hidráulica da guilhotina e testar os botões de pulso manual.",
        acaoTablet: "Clicar no botão verde 'Iniciar Produção'. Caso o sistema exija validação da etiqueta, escanear o código da bobina. Se houver OP anterior rodando, confirmar a pausa automática.",
        criterioQualidade: "Cronômetro ativo na tela confirmando o apontamento de tempo real de ciclo."
      },
      {
        numero: 3,
        titulo: "Alinhamento, Esquadro e Peça Teste de 1m",
        acaoFisica: "Alimentar a ponta do aço em velocidade de pulso lento. Ajustar as guias de entrada para 1 mm de folga total. Realizar o primeiro corte na guilhotina para esquadrejar a ponta. Programar no CLP 1 peça com 1.000 mm e executar o corte teste.",
        acaoTablet: "Manter a tela aberta aguardando a aprovação dimensional antes de liberar a produção em série.",
        criterioQualidade: "Comprimento entre 998mm e 1002mm (±2mm). Espessura dentro da tolerância nominal e largura útil de 980mm (±3mm)."
      },
      {
        numero: 4,
        titulo: "Produção Contínua e Trabalho em Dupla",
        acaoFisica: "Operador 1 programa a quantidade total e comprimentos no CLP e ativa o modo Automático. Operador 2 posiciona-se no final da mesa de roletes para receber as telhas cortadas, inspecionar acabamento visual e empilhar perfeitamente macho-fêmea.",
        acaoTablet: "Acompanhar a contagem progressiva de peças e metros na barra de progresso da OP.",
        criterioQualidade: "Fardos de no máximo 50 peças ou 1.200 kg sobre pontaletes de madeira secos a cada 1,5m."
      },
      {
        numero: 5,
        titulo: "Apontamento Obrigatório de Pausas",
        acaoFisica: "Se a máquina parar por mais de 3 minutos para troca de bobina, manutenção, falta de material ou intervalo, parar o motor e sinalizar o motivo.",
        acaoTablet: "Clicar em 'Pausar' na OP e selecionar o motivo exato: Setup, Manutenção, Falta de Material, Limpeza ou Intervalo. Ao retornar, clicar em 'Retomar'.",
        criterioQualidade: "Registro fiel para alimentar os indicadores de eficiência OEE da gerência."
      },
      {
        numero: 6,
        titulo: "Arqueação, Foto Obrigatória e Baixa",
        acaoFisica: "Arquear o fardo com fita plástica/metálica e cantoneiras de proteção. Fixar a etiqueta industrial identificando pedido, cliente, modelo e metragem.",
        acaoTablet: "Clicar em 'Finalizar Pedido'. O tablet abre a câmera para tirar a foto obrigatória do fardo pronto com a etiqueta. Confirmar metragem consumida e dar baixa.",
        criterioQualidade: "Foto nítida com boa iluminação mostrando a etiqueta e o esquadro das telhas. Fardo pronto para Expedição ou Colagem."
      }
    ],
    defeitos: [
      { sintoma: "Rebarba na ponta cortada", causa: "Navalhas da guilhotina cegas ou com folga excessiva", solucao: "Ajustar aproximação da navalha móvel; se persistir, girar ou afiar facas." },
      { sintoma: "Riscos ou marcas na pintura", causa: "Carepa ou sujeira acumulada nos rolos de conformação", solucao: "Desligar máquina, travar emergência e limpar roletes com solvente e pano macio." },
      { sintoma: "Telha com arco lateral ('banana')", causa: "Pressão desigual dos roletes entre o lado direito e esquerdo", solucao: "Regular os parafusos micrométricos de pressão dos castelos laterais." },
      { sintoma: "Comprimento cortado divergente (>3mm)", causa: "Roda do encoder patinando ou frouxa sobre o aço", solucao: "Limpar a superfície da roda de borracha e calibrar a mola do braço tensor." }
    ]
  },

  "COLAGEM": {
    id: "POP-IND-02",
    titulo: "Linha Termoacústica (Sanduíche & Bandeja)",
    subtitulo: "Sincronização de 4 postos, corte de EPS, aplicação de cola PUR e prensa pneumática",
    setor: "Barracão Telhas",
    setorKey: "telhas",
    maquinasCompativeis: ["COLAGEM", "CORTE DE EPS", "BANDEJA"],
    equipePadrao: "3 Operadores (1 na montagem/cola + 1 no EPS/ajuste + 1 na prensa/descarregamento)",
    capacidade: "Telha Sanduíche (Telha/Telha), Telha Bandeja e Telha com Manta · Núcleos 30mm a 100mm",
    corBadge: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300",
    corHeader: "from-indigo-600 to-blue-700",
    epis: [
      { nome: "Respirador PFF2 / Vapores Orgânicos", norma: "NR-6", desc: "Proteção contra névoa e vapores de isocianato da Cola PUR" },
      { nome: "Luva de Nitrila Cano Médio", norma: "NR-6", desc: "Proteção química contra contato com adesivo de poliuretano" },
      { nome: "Óculos de Ampla Visão (Goggles)", norma: "NR-6", desc: "Proteção ocular contra espirros na pressurização da cola" },
      { nome: "Luva Anticorte Nível 5", norma: "NR-6", desc: "Manuseio das telhas superior e bandeja metálicas" },
      { nome: "Botina com Bico de Aço", norma: "NR-6", desc: "Proteção no manuseio de fardos pesados na prensa" }
    ],
    regrasSeguranca: [
      "A Cola PUR reage com umidade: respingo na pele deve ser limpo imediatamente com pano seco e óleo vegetal.",
      "Mantenha o exaustor de ar da bancada de colagem sempre acionado durante a aplicação.",
      "Nunca coloque mãos ou ferramentas dentro da prensa enquanto os pistões estiverem descendo.",
      "Proibido movimentar fardos colados antes de completar os 15 minutos mínimos de cura sob pressão."
    ],
    fluxo: [
      {
        passo: 1,
        titulo: "1. Sincronia no Tablet",
        posto: "Tablet da Colagem",
        tipo: "decisao",
        tempo: "1 min",
        desc: "Checar se a Chapa Superior e a Bandeja Inferior já foram apontadas como concluídas nas perfiladeiras.",
        icone: "ShieldCheck"
      },
      {
        passo: 2,
        titulo: "2. Preparação do EPS",
        posto: "Estação de Corte EPS",
        tipo: "processo",
        tempo: "5 min",
        desc: "Separar blocos de EPS trapezoidais de 2,0m na espessura da OP (30mm, 50mm ou 100mm) e ajustar comprimento.",
        icone: "Scissors"
      },
      {
        passo: 3,
        titulo: "3. Teste de Bicos de Cola",
        posto: "Mesa de Colagem",
        tipo: "inspecao",
        tempo: "2 min",
        desc: "Disparar pulso de teste na calha de purga para garantir que todos os orifícios aplicam filetes contínuos.",
        icone: "Check"
      },
      {
        passo: 4,
        titulo: "4. Aplicação Passe 1 + Névoa",
        posto: "Mesa de Colagem",
        tipo: "processo",
        tempo: "3 min",
        desc: "Posicionar chapa inferior no batente, aplicar 180-220 g/m² de cola PUR e borrifar névoa d'água ativadora.",
        icone: "Layers"
      },
      {
        passo: 5,
        titulo: "5. Assentamento do EPS",
        posto: "Mesa de Colagem",
        tipo: "processo",
        tempo: "2 min",
        desc: "Encaixar os blocos de EPS sem degraus ou frestas antes do tempo aberto da cola (máx. 3 minutos).",
        icone: "PackageCheck"
      },
      {
        passo: 6,
        titulo: "6. Aplicação Passe 2 & Fechamento",
        posto: "Mesa de Colagem",
        tipo: "processo",
        tempo: "3 min",
        desc: "Aplicar 2º passe de cola sobre o EPS + névoa d'água e cobrir com a telha superior perfeitamente alinhada.",
        icone: "Layers"
      },
      {
        passo: 7,
        titulo: "7. Prensagem e Cura (15-25 min)",
        posto: "Prensa Pneumática",
        tipo: "processo",
        tempo: "15-25 min",
        desc: "Fechar a prensa pneumática com pressão de 0,3 a 0,5 kgf/cm² e aguardar tempo de cura sem movimentar.",
        icone: "Timer"
      },
      {
        passo: 8,
        titulo: "8. Foto da Lateral & Baixa",
        posto: "Tablet da Colagem",
        tipo: "finalizacao",
        tempo: "2 min",
        desc: "Retirar da prensa, inspecionar colagem da borda, fotografar lateral do miolo no app e dar baixa no pedido.",
        icone: "Camera"
      }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Desbloqueio Inteligente da OP no App",
        acaoFisica: "Aguardar o transporte físico da chapa superior perfilada (TP-40/Colonial) e da chapa inferior (Bandeja) até os cavaletes de espera da colagem.",
        acaoTablet: "A OP de colagem fica bloqueada com tarja vermelha até que as perfiladeiras finalizem suas partes. Assim que liberada, clicar em 'Iniciar Produção'.",
        criterioQualidade: "Ambas as metades inspecionadas sem amassados nas cristas e com as medidas idênticas."
      },
      {
        numero: 2,
        titulo: "Separação e Fracionamento de EPS (Regra dos 2m)",
        acaoFisica: "Cada bloco de EPS padrão mede 2,00 metros. Calcular a quantidade inteira e cortar frações na máquina de fio quente (ex: para 6,00m separar 3 blocos; para 5,50m separar 2 blocos de 2m + 1 bloco cortado com 1,5m).",
        acaoTablet: "Conferir o modelo cadastrado (ex: 'EPS - TP 40 BANDEJA' ou 'EPS - TP 40') para garantir o recorte trapezoidal correto.",
        criterioQualidade: "Blocos de EPS secos, sem esfarelamento e com encaixes perfeitos nas nervuras da telha."
      },
      {
        numero: 3,
        titulo: "Aplicação do 1º Passe de Cola e Névoa",
        acaoFisica: "Acomodar a chapa inferior encostada nos batentes laterais. Passar o carro dosador aplicando filetes paralelos de cola PUR (180 a 220 g/m²). Em seguida, acionar a barra atomizadora com spray fino de névoa de água.",
        acaoTablet: "Verificar se o nível de tambor de cola no app está com saldo suficiente para o lote.",
        criterioQualidade: "Distribuição uniforme de filetes sem falhas por bicos entupidos e névoa leve sem poças d'água."
      },
      {
        numero: 4,
        titulo: "Assentamento do EPS e 2º Passe de Cola",
        acaoFisica: "Posicionar os blocos de EPS imediatamente sobre a cola ainda fresca (dentro do limite de 3 minutos). Pressionar com as mãos para nivelar emendas. Passar o 2º ciclo de cola e névoa sobre a face superior do EPS.",
        acaoTablet: "Acompanhar o tempo de montagem para não ultrapassar o tempo aberto (open time) do poliuretano.",
        criterioQualidade: "Zero degrau ou folga nas emendas dos blocos de 2 metros de EPS."
      },
      {
        numero: 5,
        titulo: "Fechamento com Chapa Superior e Prensagem",
        acaoFisica: "Cobrir o sanduíche com a telha superior, alinhando rigorosamente os topos contra os batentes de esquadro. Mover o conjunto para a prensa e acionar os pistões com 0,3 a 0,5 kgf/cm².",
        acaoTablet: "Acionar o timer de cura no tablet (tempo padrão: 20 minutos; mínimo 15 minutos em dias de calor).",
        criterioQualidade: "Pressão suficiente para expandir a cola pelos poros do EPS sem esmagar ou deformar o trapézio."
      },
      {
        numero: 6,
        titulo: "Refile, Inspeção Anti-Delaminação e Baixa",
        acaoFisica: "Retirar da prensa após término do cronômetro. Fazer refile de sobras de cola/EPS com estilete nas pontas. Realizar teste de puxamento manual nas abas para comprovar colagem estrutural.",
        acaoTablet: "Clicar em 'Finalizar Pedido'. Tirar foto nítida e aproximada da lateral da telha mostrando a união perfeita do miolo de EPS com o aço e anexar a etiqueta industrial.",
        criterioQualidade: "Adesão total sem bolhas ou pontos ocos. Foto registrada e lote transferido para Logística."
      }
    ],
    defeitos: [
      { sintoma: "Chapa soltando do EPS (Delaminação)", causa: "Tempo de prensa menor que 15 min ou bicos de cola entupidos", solucao: "Desobstruir bicos aplicadores e respeitar tempo mínimo de cura sob pressão." },
      { sintoma: "Cola escorrendo e manchando a telha", causa: "Excesso de adesivo (>230 g/m²) ou pressão da prensa muito alta", solucao: "Ajustar vazão da bomba dosadora e calibrar pressão para 0,3-0,4 kgf/cm²." },
      { sintoma: "Degrau perceptível no teto do cliente", causa: "Emendas de EPS com espessuras ligeiramente diferentes", solucao: "Usar blocos de EPS do mesmo lote de corte e lixar emendas antes da colagem." },
      { sintoma: "Cola não secou após sair da prensa", causa: "Falta de umidade ativadora (névoa inoperante) ou cola vencida", solucao: "Testar bico aspersor de água e conferir data de validade no tambor de PUR." }
    ]
  },

  "DESBOBINADEIRA 01": {
    id: "POP-IND-03A",
    titulo: "Desbobinadeira 01 (Chapas até 3,00 mm)",
    subtitulo: "Aplanamento, esquadrejo e corte de chapas planas leves e médias",
    setor: "Corte e Dobra",
    setorKey: "corte_dobra",
    maquinasCompativeis: ["DESBOBINADEIRA 01", "DESBOBINADEIRA"],
    equipePadrao: "2 Operadores (1 no comando/ponte + 1 no empilhamento da chaparia)",
    capacidade: "Aço Carbono e Galvanizado até 3,00mm (#11 a #28) · Bobinas até 15 toneladas",
    corBadge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
    corHeader: "from-blue-600 to-cyan-700",
    epis: [
      { nome: "Luva Anticorte Nível 5 com Grip", norma: "NR-6", desc: "Manuseio de chapas planas com bordas vivas de corte" },
      { nome: "Mangote Anticorte Kevlar", norma: "NR-6", desc: "Proteção total dos braços na saída da mesa de empilhamento" },
      { nome: "Botina de Bico de Aço com Metatarso", norma: "NR-6", desc: "Proteção contra queda de fardos pesados de chapas" },
      { nome: "Capacete com Jugular", norma: "NR-11", desc: "Uso obrigatório na área de carga suspensa da ponte rolante" },
      { nome: "Óculos de Segurança", norma: "NR-6", desc: "Proteção contra carepa e partículas soltas no desbobinamento" }
    ],
    regrasSeguranca: [
      "Trava de Espessura: É proibido colocar bobinas acima de 3,00 mm nesta máquina (usar a Desb. 02).",
      "Nunca passe por baixo da bobina suspensa pela ponte rolante em hipótese alguma.",
      "Manter mãos afastadas dos rolos aplanadores com a máquina ligada.",
      "Cavaletes de empilhamento de chapas devem estar nivelados e com travas laterais operantes."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Consulta no Tablet", posto: "Tablet CD", tipo: "processo", tempo: "2 min", desc: "Checar espessura da OP (máx 3,00mm) e comprimento das chapas.", icone: "Tablet" },
      { passo: 2, titulo: "2. Içar Bobina", posto: "Ponte Rolante", tipo: "processo", tempo: "10 min", desc: "Içar bobina, fixar no mandril expansivo e cortar fita de arqueamento.", icone: "Crane" },
      { passo: 3, titulo: "3. Iniciar OP no App", posto: "Tablet CD", tipo: "processo", tempo: "1 min", desc: "Validar etiqueta e iniciar contagem de produção.", icone: "Play" },
      { passo: 4, titulo: "4. Nivelar & Desempenar", posto: "Rolos Aplanadores", tipo: "inspecao", tempo: "4 min", desc: "Ajustar pressão dos cilindros aplanadores para zerar o efeito canoa.", icone: "Sliders" },
      { passo: 5, titulo: "5. Corte de 1ª Chapa & Diagonais", posto: "Guilhotina da Desbobinadeira", tipo: "decisao", tempo: "3 min", desc: "Medir diagonais cruzadas na trena: diferença máxima admissível ≤ 2 mm.", icone: "Ruler" },
      { passo: 6, titulo: "6. Produção do Lote de Chapas", posto: "Mesa Receptora", tipo: "processo", tempo: "20 min", desc: "Desbobinar fardo no comprimento (ex: 3m/6m) e empilhar alinhado.", icone: "Layers" },
      { passo: 7, titulo: "7. Gerar Etiqueta 'ChapaCD'", posto: "Tablet CD", tipo: "finalizacao", tempo: "2 min", desc: "Tirar foto do fardo, salvar saldo de chapas no módulo Chaparia e dar baixa.", icone: "Camera" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Verificação da Trava de 3,00 mm e Içamento",
        acaoFisica: "Conferir a espessura na etiqueta da usina. Se for superior a 3,00 mm, cancelar a montagem e encaminhar para a Desbobinadeira 02. Içar a bobina até 3,00mm com a ponte rolante e travar no mandril.",
        acaoTablet: "No tablet da Desbobinadeira 01, verificar que apenas bobinas até 3,00 mm aparecem disponíveis para seleção.",
        criterioQualidade: "Bobina travada perfeitamente centrada no mandril."
      },
      {
        numero: 2,
        titulo: "Ajuste de Aplanamento e Eliminação de Memória",
        acaoFisica: "Passar a ponta do aço pelos cilindros aplanadores em velocidade de pulso. Regular a altura dos rolos superiores até que a chapa saia perfeitamente reta sem encurvar para cima ou para baixo.",
        acaoTablet: "Iniciar a ordem no sistema para contagem de tempo de ciclo.",
        criterioQualidade: "Chapa 100% plana repousando sobre a mesa sem efeito de flexão residual."
      },
      {
        numero: 3,
        titulo: "Teste de Esquadro e Diagonais Cruzadas",
        acaoFisica: "Cortar a primeira chapa do lote. Esticar a trena nas duas diagonais em X. A diferença entre a diagonal A e a diagonal B deve ser de no máximo 2,0 mm.",
        acaoTablet: "Registrar a confirmação de conformidade dimensional na tela da máquina.",
        criterioQualidade: "Diferença entre diagonais $\le 2\text{ mm}$ e comprimento com precisão de $\pm 2\text{ mm}$."
      },
      {
        numero: 4,
        titulo: "Empilhamento e Cadastro no Módulo Chaparia",
        acaoFisica: "Operador 2 empilha as chapas no cavalete com separadores de madeira a cada 50 peças para permitir o garfo da empilhadeira.",
        acaoTablet: "Clicar em 'Finalizar Ordem' e 'Registrar Chaparia'. O sistema gera o lote na entidade `ChapaCD` disponível para as guilhotinas de 3m e 6m.",
        criterioQualidade: "Fardo etiquetado com código de barras, peso em kg e espessura real."
      }
    ],
    defeitos: [
      { sintoma: "Chapa saindo com efeito canoa (arqueamento)", causa: "Pressão excessiva ou desigual nos roletes aplanadores", solucao: "Aliviar parafusos dos rolos intermediários e reajustar batentes." },
      { sintoma: "Diagonais fora de esquadro (> 3mm)", causa: "Guia de entrada torta ou desalinhamento da faca", solucao: "Alinhar régua lateral contra o batente a 90 graus exatos." }
    ]
  },

  "DESBOBINADEIRA 02": {
    id: "POP-IND-03B",
    titulo: "Desbobinadeira 02 (Chapas Pesadas até 4,75 mm)",
    subtitulo: "Aplanamento e corte de chapas grossas estruturais e bitolas pesadas",
    setor: "Corte e Dobra",
    setorKey: "corte_dobra",
    maquinasCompativeis: ["DESBOBINADEIRA 02"],
    equipePadrao: "2 Operadores (Atenção redobrada para içamento de bobinas pesadas)",
    capacidade: "Chapas grossas de 3,05mm até 4,75mm (3/16\") · Cargas elevadas",
    corBadge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
    corHeader: "from-amber-600 to-orange-700",
    epis: [
      { nome: "Luva Anticorte Reforçada Nível 5", norma: "NR-6", desc: "Manuseio de chapas pesadas com grande inércia" },
      { nome: "Mangote Anticorte Reforçado", norma: "NR-6", desc: "Proteção contra cantos vivos pesados" },
      { nome: "Botina de Bico de Aço e Metatarso", norma: "NR-6", desc: "Obrigatória contra impacto de peças grossas" },
      { nome: "Capacete com Jugular", norma: "NR-11", desc: "Uso obrigatório na operação com a ponte rolante" }
    ],
    regrasSeguranca: [
      "Operação de Alta Força: Nunca posicione membros sob a viga de prensagem pesada.",
      "Respeitar o limite máximo de 4,75 mm (nunca operar chapas acima de 3/16\").",
      "O corte de fita de arqueamento de bobinas grossas possui forte efeito mola: manter distância frontal de 2 metros."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Consulta no Tablet", posto: "Tablet CD", tipo: "processo", tempo: "2 min", desc: "Verificar ordens de chapas pesadas (3,05mm a 4,75mm).", icone: "Tablet" },
      { passo: 2, titulo: "2. Içamento com Ponte", posto: "Ponte Rolante", tipo: "processo", tempo: "12 min", desc: "Içamento cuidadoso de bobina pesada com garra C-Hook e fixação no mandril hidráulico.", icone: "Crane" },
      { passo: 3, titulo: "3. Nivelamento Pesado", posto: "Cilindros de Desempeno", tipo: "processo", tempo: "5 min", desc: "Ajustar pressão hidráulica dos rolos aplanadores reforçados.", icone: "Sliders" },
      { passo: 4, titulo: "4. Teste de Diagonais", posto: "Mesa de Corte", tipo: "inspecao", tempo: "4 min", desc: "Conferir esquadro e espessura real com paquímetro digital.", icone: "Ruler" },
      { passo: 5, titulo: "5. Corte & Chaparia", posto: "Mesa Receptora", tipo: "finalizacao", tempo: "25 min", desc: "Cortar fardo, fotografar e registrar saldo de chapas pesadas no app.", icone: "Camera" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Içamento de Carga Pesada e Mandril Reforçado",
        acaoFisica: "Operar a ponte rolante em velocidade reduzida para evitar balanço de bobinas acima de 10 toneladas. Travar a expansão hidráulica com pressão máxima de segurança.",
        acaoTablet: "Selecionar a máquina 'DESBOBINADEIRA 02' no tablet e clicar em iniciar OP.",
        criterioQualidade: "Fixação sólida no eixo sem qualquer folga axial."
      },
      {
        numero: 2,
        titulo: "Aplanamento com Alta Pressão Hidráulica",
        acaoFisica: "Chapas de 4,75 mm exigem torque e pressão hidráulica elevados. Monitorar os manômetros de pressão dos rolos para manter o aplanamento sem estrias no aço.",
        acaoTablet: "Registrar pausas de setup caso haja necessidade de calibração.",
        criterioQualidade: "Chapa espessa perfeitamente reta para alimentação suave nas dobradeiras de 6m."
      }
    ],
    defeitos: [
      { sintoma: "Chapa pesada com ponta dobrada", causa: "Pressão insuficiente no rolo introdutor de entrada", solucao: "Aumentar a pressão do pistão do introdutor hidráulico." }
    ]
  },

  "GUILHOTINAS": {
    id: "POP-IND-03C",
    titulo: "Guilhotinas 3m e 6m (Corte de Blanks)",
    subtitulo: "Corte de precisão de tiras para dobra e aproveitamento sistemático de retalhos",
    setor: "Corte e Dobra",
    setorKey: "corte_dobra",
    maquinasCompativeis: ["CORTE 3M", "CORTE 6M"],
    equipePadrao: "2 Operadores (Guilhotina 6m) ou 1 Operador (Guilhotina 3m)",
    capacidade: "Corte de blanks até 6.000 mm no comprimento com encosto digital micrométrico",
    corBadge: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300",
    corHeader: "from-teal-600 to-emerald-700",
    epis: [
      { nome: "Luva Anticorte Nível 5 com Grip", norma: "NR-6", desc: "Obrigatória em 100% do tempo ao alimentar chapas na mesa" },
      { nome: "Mangote de Proteção Anticorte", norma: "NR-6", desc: "Proteção contra arestas cortantes de chapas longas de 6m" },
      { nome: "Botina de Segurança com Bico de Aço", norma: "NR-6", desc: "Proteção dos pés contra queda de tiras e blanks pesados" },
      { nome: "Protetor Auricular", norma: "NR-15", desc: "Impacto sonoro do golpe de corte das navalhas" }
    ],
    regrasSeguranca: [
      "NR-12 Rigorosa: Nunca posicione mãos ou dedos na linha das facas ou dos pisões hidráulicos de fixação.",
      "As cortinas de luz frontais não devem ser desativadas sob nenhuma hipótese.",
      "O pedal de acionamento elétrico deve possuir capa de proteção mecânica contra pisada involuntária."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Consultar Desenvolvimento", posto: "Tablet CD", tipo: "processo", tempo: "2 min", desc: "Abrir a ficha da peça e checar a largura desenvolvida (blank em mm).", icone: "Calculator" },
      { passo: 2, titulo: "2. Regular Encosto Traseiro", posto: "Painel Delem/CLP", tipo: "processo", tempo: "1 min", desc: "Digitar a cota exata no batente traseiro motorizado da guilhotina.", icone: "Sliders" },
      { passo: 3, titulo: "3. Regular Folga de Navalhas", posto: "Alavanca de Gap", tipo: "inspecao", tempo: "1 min", desc: "Ajustar o gap de facas conforme a espessura do aço (0,08 x espessura).", icone: "Scissors" },
      { passo: 4, titulo: "4. Cortar 1ª Tira & Paquímetro", posto: "Mesa da Guilhotina", tipo: "decisao", tempo: "2 min", desc: "Cortar primeira tira e medir largura em 3 pontos com paquímetro (±0,5mm).", icone: "Ruler" },
      { passo: 5, titulo: "5. Corte do Lote Completo", posto: "Guilhotina 3m ou 6m", tipo: "processo", tempo: "15 min", desc: "Executar o plano de corte e transferir blanks para a dobradeira.", icone: "Layers" },
      { passo: 6, titulo: "6. Classificar Retalhos", posto: "Tablet CD", tipo: "finalizacao", tempo: "3 min", desc: "Sobras ≥ 100x500mm cadastrar como 'RetalhoCD'; miúdos descartar na caçamba.", icone: "PackageCheck" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Interpretação do Blank no Módulo de Desenvolvimento",
        acaoFisica: "Localizar o fardo de chapas planas no estoque de Chaparia conforme espessura indicada.",
        acaoTablet: "Consultar a ficha técnica da peça no menu 'Desenvolvimento C&D'. O sistema calcula a soma das abas descontando a compensação de dobra (fator K).",
        criterioQualidade: "Largura desenvolvida exata para que o perfil final atinja as cotas nominais."
      },
      {
        numero: 2,
        titulo: "Regulagem de Gap e Corte no Esquadro",
        acaoFisica: "Ajustar a folga entre navalhas. Apoiar a chapa firmemente contra a régua guia com esquadro lateral e acionar o pedal.",
        acaoTablet: "Iniciar a ordem de corte no tablet para acompanhamento de produção.",
        criterioQualidade: "Tira com borda de corte limpa, sem rebarba ou esmagamento excessivo (tolerância $\pm 0,5\text{ mm}$)."
      },
      {
        numero: 3,
        titulo: "Gestão Sistemática de Retalhos (`RetalhoCD`)",
        acaoFisica: "Tiras e pontas de chapas úteis (maiores que 100 x 500 mm) são guardadas nas gaiolas e cavaletes identificados.",
        acaoTablet: "Cadastrar a sobra no módulo 'Retalhos', informando dimensões e localização física. O sistema disponibiliza o retalho para futuras OPs.",
        criterioQualidade: "Zero acúmulo desordenado de sobras no chão da fábrica."
      }
    ],
    defeitos: [
      { sintoma: "Borda cortada com rebarba excessiva", causa: "Folga entre navalhas muito grande para a espessura da chapa", solucao: "Diminuir o gap das navalhas na alavanca graduada." },
      { sintoma: "Tira cortada com largura cônica", causa: "Encosto traseiro desregulado ou chapa não encostou até o fim", solucao: "Calibrar o paralelismo do encosto traseiro contra as facas." }
    ]
  },

  "DOBRADEIRAS": {
    id: "POP-IND-03D",
    titulo: "Dobradeiras 3m e 6m (Conformação de Perfis)",
    subtitulo: "Dobra angular de precisão com matriz multi-V e punções intercambiáveis",
    setor: "Corte e Dobra",
    setorKey: "corte_dobra",
    maquinasCompativeis: ["DOBRA 3M", "DOBRA INICIO 6M", "DOBRA FUNDO 6M"],
    equipePadrao: "2 Operadores (Dobra 6m) ou 1 Operador (Dobra 3m)",
    capacidade: "Perfis estruturais U, Enrijecidos, Calhas, Rufos e Dobras Especiais até 6 metros",
    corBadge: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
    corHeader: "from-purple-600 to-indigo-700",
    epis: [
      { nome: "Luva Anticorte Nível 5", norma: "NR-6", desc: "Manuseio seguro das abas das chapas durante a flexão angular" },
      { nome: "Mangote de Proteção", norma: "NR-6", desc: "Proteção contra efeito chicote de peças longas de 6m" },
      { nome: "Botina de Bico de Aço", norma: "NR-6", desc: "Proteção dos membros inferiores no entorno da dobradeira" },
      { nome: "Óculos de Proteção", norma: "NR-6", desc: "Proteção permanente no posto de trabalho" }
    ],
    regrasSeguranca: [
      "Atenção ao Efeito Chicote: Durante a descida do punção, a chapa sobe rapidamente. Mantenha os braços na posição correta de acompanhamento suave.",
      "Nunca segure a peça por baixo da matriz durante a conformação.",
      "Peças estreitas exigem uso de pinças magnéticas manuais."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Escolher Canal V da Matriz", posto: "Mesa da Dobradeira", tipo: "processo", tempo: "3 min", desc: "Aplicar a regra V = 6 a 8 x Espessura do aço (ex: chapa 2mm usa V de 16mm).", icone: "Sliders" },
      { passo: 2, titulo: "2. Programar Ângulos & Batentes", posto: "Painel CLP/CNC", tipo: "processo", tempo: "3 min", desc: "Digitar sequência de dobras da aba externa para o centro.", icone: "Sliders" },
      { passo: 3, titulo: "3. Dobrar 1ª Peça Teste", posto: "Dobradeira 3m ou 6m", tipo: "inspecao", tempo: "2 min", desc: "Conformar peça teste e afere ângulos com goniômetro digital (90° ± 1°).", icone: "Ruler" },
      { passo: 4, titulo: "4. Dobra do Lote em Série", posto: "Dobradeira 3m ou 6m", tipo: "processo", tempo: "20 min", desc: "Executar a produção de todas as peças do pedido com acompanhamento suave.", icone: "Layers" },
      { passo: 5, titulo: "5. Amarração & Foto do Topo", posto: "Bancada de Saída", tipo: "finalizacao", tempo: "3 min", desc: "Arquear fardo com cantoneiras, tirar foto nítida do topo dos perfis e dar baixa.", icone: "Camera" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Seleção da Matriz e Regra do V",
        acaoFisica: "Girar o bloco de matriz inferior até o canal V correspondente à espessura da chapa ($V = 6 \text{ a } 8 \times e$). Centralizar o punção com o centro do V.",
        acaoTablet: "Verificar no tablet os ângulos e medidas de cada aba do perfil encomendado.",
        criterioQualidade: "Raio de dobra interno uniforme sem trincar o aço na aresta externa."
      },
      {
        numero: 2,
        titulo: "Conferência Angular com Goniômetro Digital",
        acaoFisica: "Executar a primeira dobra. Medir o ângulo em três pontos ao longo dos 6 metros com goniômetro ou transferidor de graus ($90^\circ \pm 1^\circ$). Ajustar o coroamento (crowning) da mesa se as pontas estiverem diferentes do meio.",
        acaoTablet: "Aprovar a peça teste no tablet antes de liberar o restante das peças.",
        criterioQualidade: "Ângulo rigoroso e abas com medidas exatas na trena e paquímetro."
      },
      {
        numero: 3,
        titulo: "Amarração de Fardo e Foto do Topo",
        acaoFisica: "Empilhar os perfis encaixados, colocar cantoneiras plásticas e arquear.",
        acaoTablet: "Clicar em 'Finalizar Pedido'. Tirar foto nítida do topo das peças evidenciando o desenho geométrico e a etiqueta do cliente.",
        criterioQualidade: "Fardo firme, etiquetado e enviado para o Pátio de Expedição."
      }
    ],
    defeitos: [
      { sintoma: "Ângulo aberto no meio e fechado nas pontas", causa: "Flexão natural da mesa sob carga pesada", solucao: "Calibrar o sistema de coroamento hidráulico/mecânico (crowning)." },
      { sintoma: "Aba do perfil fora da medida", causa: "Encosto traseiro desregulado ou operador não empurrou até o batente", solucao: "Zerar o batente e apoiar a tira de aço até o fim do curso." }
    ]
  },

  "RECEBIMENTO": {
    id: "POP-IND-04",
    titulo: "Expedição, Recebimento & Armazenagem",
    subtitulo: "Barreira de balança de 3%, OCR de Nota Fiscal, mapa de ruas e validade de 6 meses",
    setor: "Expedição",
    setorKey: "expedicao",
    maquinasCompativeis: ["RECEBIMENTO", "EXPEDICAO", "FRISADA"],
    equipePadrao: "Conferente de Pátio + Operador de Ponte/Empilhadeira",
    capacidade: "Entrada de bobinas, tubos, perfis estruturais e chapas · Máquina de Frisada com bobinas 'EX'",
    corBadge: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300",
    corHeader: "from-teal-600 to-cyan-700",
    epis: [
      { nome: "Colete Refletivo Classe 2", norma: "NR-11", desc: "Obrigatório no pátio de manobras de carretas e empilhadeiras" },
      { nome: "Botina de Bico de Aço", norma: "NR-6", desc: "Proteção no descarregamento de fardos de barras e bobinas" },
      { nome: "Capacete com Carneira", norma: "NR-11", desc: "Uso obrigatório sob a área de içamento de pontes e muncks" },
      { nome: "Luva Anticorte Nível 5", norma: "NR-6", desc: "Manuseio de amarrações de fardos e chapas de aço" }
    ],
    regrasSeguranca: [
      "Barreira Rígida de 3%: Proibido descarregar caminhão com divergência de peso acima de 3% sem aval do ADM.",
      "Zona de Exclusão de Pedestres: Motorista deve aguardar na sala de espera ou fora do raio da carga suspensa.",
      "Nunca suba sobre a carroceria com a ponte rolante em movimento."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Foto da NF (OCR)", posto: "Tablet Expedição", tipo: "processo", tempo: "1 min", desc: "Fotografar DANFE. IA extrai fornecedor, itens, peso e quantidade.", icone: "Camera" },
      { passo: 2, titulo: "2. Peso Teórico", posto: "Sistema AJL", tipo: "processo", tempo: "0 min", desc: "Sistema calcula peso teórico automático em kg/m para conferência.", icone: "Calculator" },
      { passo: 3, titulo: "3. Pesagem na Balança", posto: "Balança Industrial", tipo: "processo", tempo: "3 min", desc: "Pesar lote e anexar OBRIGATORIAMENTE foto do visor digital da balança.", icone: "Scale" },
      { passo: 4, titulo: "4. Trava de Divergência (≤ 3%)", posto: "Sistema AJL", tipo: "decisao", tempo: "1 min", desc: "Se diferença > 3%, status fica 'divergente' e descarga é BLOQUEADA até aval do ADM.", icone: "ShieldAlert" },
      { passo: 5, titulo: "5. Descarga & Foto de Avarias", posto: "Pátio / Ponte", tipo: "inspecao", tempo: "15 min", desc: "Descarregar com segurança e fotografar o lote aberto (verificar ferrugem/danos).", icone: "Camera" },
      { passo: 6, titulo: "6. Endereçamento & Validade", posto: "Mapa de Armazenagem", tipo: "finalizacao", tempo: "2 min", desc: "Definir Rua e Posição. Sistema grava validade de 6 meses e libera o saldo.", icone: "MapPin" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Leitura Automatizada da Nota Fiscal (OCR Vision)",
        acaoFisica: "Solicitar o DANFE impresso ao motorista da carreta.",
        acaoTablet: "No tablet da Expedição, acessar 'Receber Material'. Fotografar o documento. O sistema preenche automaticamente número da NF, fornecedor, quantidade de barras e peso faturado.",
        criterioQualidade: "Dados conferidos contra o pedido de compras da empresa."
      },
      {
        numero: 2,
        titulo: "Pesagem Obrigatória e Foto do Display",
        acaoFisica: "Pesar o caminhão ou içar o fardo com a balança suspensa aferida.",
        acaoTablet: "Digitar o peso apurado e tirar foto nítida do display digital da balança. O sistema compara peso NF vs Balança vs Teórico.",
        criterioQualidade: "Divergência menor ou igual a 3,0%. Se superior, descarga fica suspensa até aprovação do ADM."
      },
      {
        numero: 3,
        titulo: "Endereçamento no Mapa de Ruas e Validade de 6 Meses",
        acaoFisica: "Alocar o lote na rua e posição física definidas sobre pontaletes secos.",
        acaoTablet: "Tirar foto do material no chão do pátio e selecionar a Rua/Posição no mapa visual. O sistema ativa a data de validade de 6 meses para controle de ociosidade.",
        criterioQualidade: "Material identificado e localizado no mapa com ocupação percentual calculada."
      }
    ],
    defeitos: [
      { sintoma: "Divergência de peso > 3%", causa: "Erro na usina faturadora ou fardo esquecido no caminhão", solucao: "Reter descarga, notificar encarregado e aguardar aval formal da gerência." },
      { sintoma: "Material com ferrugem branca", causa: "Infiltração de água no transporte", solucao: "Fotografar para termo de avaria e comunicar fornecedor imediatamente." }
    ]
  },

  "LOGISTICA": {
    id: "POP-IND-05",
    titulo: "Logística, Carregamento & Frota",
    subtitulo: "Timeline fotográfica em 5 etapas, amarração CONTRAN 552 e liberação de portaria",
    setor: "Logística",
    setorKey: "logistica",
    maquinasCompativeis: ["LOGISTICA", "CALENDARIO", "TIMELINE"],
    equipePadrao: "Conferente de Logística + Operador de Ponte + Motorista",
    capacidade: "Expedição de cargas para as 4 filiais e clientes finais com frota própria e terceiros",
    corBadge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
    corHeader: "from-emerald-600 to-green-700",
    epis: [
      { nome: "Colete Refletivo Classe 2", norma: "NR-11", desc: "Obrigatório para conferente e motorista em pista de doca" },
      { nome: "Capacete com Jugular", norma: "NR-11", desc: "Proteção obrigatória sob vigas de pontes rolantes" },
      { nome: "Luva Anticorte Nível 5", norma: "NR-6", desc: "Manuseio de cintas, cantoneiras e cantos de aço" },
      { nome: "Botina de Bico de Aço", norma: "NR-6", desc: "Proteção contra prensamento de pés" }
    ],
    regrasSeguranca: [
      "Calço de Pneu Obrigatório: Todo caminhão que encosta na doca deve ter calços colocados nas rodas traseiras.",
      "Chave na Guarita: O motorista deve desligar o veículo e entregar a chave ao conferente antes do embarque.",
      "Amarração CONTRAN 552: Proibido uso de cordas para fixação primária; usar cintas têxteis de 5t com catraca.",
      "Cantoneiras Obrigatórias: É mandatório colocar cantoneiras em 100% dos cantos vivos onde a cinta toca o aço."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Roteirização LIFO", posto: "App Logística", tipo: "processo", tempo: "5 min", desc: "Sequenciar carga: 1º cliente da rota deve ser o último fardo embarcado na traseira.", icone: "Route" },
      { passo: 2, titulo: "📸 Etapa 1: Veículo Vazio", posto: "Doca de Carga", tipo: "inspecao", tempo: "3 min", desc: "Fotografar assoalho limpo, sem farpas, com pontaletes de madeira alinhados.", icone: "Camera" },
      { passo: 3, titulo: "📸 Etapa 2: Base Pesada", posto: "Doca de Carga", tipo: "processo", tempo: "15 min", desc: "Embarcar perfis e chapas pesadas de C&D no piso e fotografar.", icone: "Camera" },
      { passo: 4, titulo: "📸 Etapa 3: Telhas & Painéis", posto: "Doca de Carga", tipo: "processo", tempo: "20 min", desc: "Embarcar fardos de telhas e sanduíche sobre a base com proteção e fotografar.", icone: "Camera" },
      { passo: 5, titulo: "📸 Etapa 4: Cintas & Catracas", posto: "Doca de Carga", tipo: "inspecao", tempo: "10 min", desc: "Tensionar cintas de 5t com catracas e cantoneiras de borracha em todos os cantos e fotografar.", icone: "Camera" },
      { passo: 6, titulo: "📸 Etapa 5: Lona & Placa", posto: "Doca de Carga", tipo: "finalizacao", tempo: "10 min", desc: "Carga 100% coberta com lona, amarrada e placa legível na foto. Botão de saída é LIBERADO.", icone: "ShieldCheck" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Roteirização LIFO e Vistoria do Assoalho (Etapa 1)",
        acaoFisica: "O caminhão encosta, calça as rodas e o motorista entrega as chaves. O conferente vistoria o assoalho varrido e instala caibros de apoio.",
        acaoTablet: "Abrir a 'Timeline de Carregamento' no tablet. Clicar em 'Registrar Etapa 1' e fotografar o assoalho limpo e pronto.",
        criterioQualidade: "Zero pregos ou farpas que possam riscar as telhas inferiores."
      },
      {
        numero: 2,
        titulo: "Embarque da Base Pesada e Telhas (Etapas 2 e 3)",
        acaoFisica: "Carregar materiais densos de corte & dobra no piso. Em seguida, içar os fardos de telhas com cintas largas e assentar sobre calços protetores.",
        acaoTablet: "Fotografar a Etapa 2 (Base Pesada) e em seguida a Etapa 3 (Telhas e Painéis).",
        criterioQualidade: "Distribuição correta de peso por eixo e cristas das telhas perfeitamente alinhadas."
      },
      {
        numero: 3,
        titulo: "Amarração Técnica com Cantoneiras (Etapa 4)",
        acaoFisica: "Passar cintas de poliéster 5t a cada 1,5m de carga. Colocar cantoneiras plásticas/borracha em todas as bordas vivas para não amassar as telhas e tensionar as catracas.",
        acaoTablet: "Fotografar a Etapa 4 comprovando as cintas tensionadas com cantoneiras.",
        criterioQualidade: "Conformidade 100% com a Resolução CONTRAN 552."
      },
      {
        numero: 4,
        titulo: "Enlonamento, Placa e Liberação de Portaria (Etapa 5)",
        acaoFisica: "Cobrir toda a carga com lona impermeável amarrada firmemente com borrachas.",
        acaoTablet: "Tirar a foto da Etapa 5 mostrando o caminhão lonado com a placa e motorista visíveis. Clicar em 'Confirmar Saída'. O status muda para 'em_transito' no Odoo.",
        criterioQualidade: "Todas as 5 etapas com fotos registradas no app; saída liberada com romaneio assinado."
      }
    ],
    defeitos: [
      { sintoma: "Telhas amassadas na entrega", causa: "Cinta tensionada diretamente contra o aço sem cantoneira de borracha", solucao: "Obrigatoriedade de cantoneiras em 100% dos cantos antes da catraca." },
      { sintoma: "Manchas de ferrugem branca em telhas galvalume", causa: "Lona rasgada ou transporte sem cobertura sob chuva", solucao: "Vistoriar lona antes de autorizar a saída e cobrir 100% da carga." }
    ]
  },

  "PCP_CENTRAL": {
    id: "POP-PCP-01",
    titulo: "Central PCP & Recepção Odoo",
    subtitulo: "Aba Mãe: Recepção via Webhook, filtros inteligentes, roteamento fabril e simulador",
    setor: "PCP",
    setorKey: "pcp",
    maquinasCompativeis: ["PCP", "CENTRAL PCP", "ODOO"],
    equipePadrao: "Gestor de PCP / Encarregado Geral",
    capacidade: "Processamento contínuo em tempo real de pedidos comerciais das 4 filiais",
    corBadge: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300",
    corHeader: "from-orange-600 to-amber-700",
    epis: [
      { nome: "Operação em Sala de Controle", norma: "NR-17", desc: "Ergonomia no posto informatizado de despacho" }
    ],
    regrasSeguranca: [
      "Nunca altere o número da Ordem de Fabricação (OF) para não quebrar a sincronização com o Odoo.",
      "Pedidos com itens de revenda (parafusos/fitas) são ignorados pela fábrica e atendidos direto pelo almoxarifado."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Venda Confirmada no Odoo", posto: "Comercial Odoo", tipo: "processo", tempo: "Instantâneo", desc: "Vendedor fecha o pedido; gatilho Webhook envia dados via JSON para o App AJL.", icone: "Zap" },
      { passo: 2, titulo: "2. Triagem Automática", posto: "Central PCP", tipo: "decisao", tempo: "1 seg", desc: "O sistema analisa itens: Telhas vão para Barracão Telhas, Perfis/Chapas vão para C&D.", icone: "Filter" },
      { passo: 3, titulo: "3. Filtro por Vendedor/Cliente", posto: "Painel PCP", tipo: "processo", tempo: "Livre", desc: "Use a busca rápida (Cliente, Vendedor, Nº Pedido ou Modelo de telha) para auditar a fila.", icone: "Search" },
      { passo: 4, titulo: "4. Auditoria de Webhook", posto: "Central PCP", tipo: "inspecao", tempo: "1 min", desc: "Em caso de instabilidade, usar 'Recuperar Pedido Odoo' digitando o número S00...", icone: "RefreshCw" },
      { passo: 5, titulo: "5. Distribuição para Máquinas", posto: "PCP -> Tablets", tipo: "finalizacao", tempo: "Automático", desc: "OPs aparecem instantaneamente no tablet dos operadores no chão de fábrica.", icone: "Send" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Recepção Automática via Webhook Odoo",
        acaoFisica: "O vendedor confirma o orçamento no sistema comercial Odoo.",
        acaoTablet: "A Central PCP recebe a notificação instantânea. Não há necessidade de redigitar pedidos, medidas ou espessuras.",
        criterioQualidade: "Pedido importado com cliente, vendedor, itens e medidas idênticos ao faturamento."
      },
      {
        numero: 2,
        titulo: "Filtros Rápidos e Busca Especializada",
        acaoFisica: "Gestor consulta demandas urgentes solicitadas pela diretoria.",
        acaoTablet: "Na Central PCP, selecionar o filtro por: Cliente, Vendedor, Nº da OF ou Modelos Rápidos (TP-40, Sanduíche, C&D, Pré-Pintada).",
        criterioQualidade: "Localização instantânea de qualquer pedido em menos de 3 segundos."
      },
      {
        numero: 3,
        titulo: "Simulação e Recuperação de Pedidos Perdidos",
        acaoFisica: "Vendedor alega que confirmou pedido no Odoo mas não apareceu na fábrica.",
        acaoTablet: "Clicar no botão 'Recuperar Pedido Odoo' no topo da Central PCP. Digitar o número (ex: S00123). O sistema consulta a API do Odoo e recria a ordem na fila.",
        criterioQualidade: "Rastreabilidade e recuperação sem perda de informações de engenharia."
      }
    ],
    defeitos: [
      { sintoma: "Pedido não apareceu na tela da fábrica", causa: "Webhook Odoo falhou por queda de internet ou categoria errada", solucao: "Usar o botão 'Recuperar Pedido Odoo' no topo da Central PCP." }
    ]
  },

  "PCP_FILA": {
    id: "POP-PCP-02",
    titulo: "Gestão da Fila PCP, Prioridades FIFO & Bloqueios",
    subtitulo: "Sequenciamento inteligente, tarja Retira Agora, bloqueio sem matéria-prima e lojas",
    setor: "PCP",
    setorKey: "pcp",
    maquinasCompativeis: ["PCP", "FILA", "CENTRAL PCP"],
    equipePadrao: "Gestor de PCP / Encarregados de Fábrica",
    capacidade: "Controle de SLA, capacidade diária por IA e balanceamento entre as 4 filiais",
    corBadge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300",
    corHeader: "from-red-600 to-rose-700",
    epis: [
      { nome: "Operação Informatizada", norma: "NR-17", desc: "Acompanhamento visual em telas de pátio e fábrica" }
    ],
    regrasSeguranca: [
      "Proibido iniciar OP em máquina sem liberação formal de matéria-prima no estoque.",
      "Prioridades P1 ('Retira Agora') exigem senha de gestor para evitar fura-filas indevidos."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Sequenciamento FIFO Padrão", posto: "Central PCP", tipo: "processo", tempo: "Automático", desc: "Pedidos ordenados cronologicamente pela data de confirmação e SLA de entrega.", icone: "Clock" },
      { passo: 2, titulo: "2. Checagem de Saldo em Estoque", posto: "Sistema AJL", tipo: "decisao", tempo: "Instantâneo", desc: "O sistema cruza a bobina/chapa com o saldo físico real do barracão.", icone: "Layers" },
      { passo: 3, titulo: "3. Trava 'Sem Matéria-Prima'", posto: "Fila PCP", tipo: "decisao", tempo: "Automático", desc: "Se não houver bobina suficiente, a OP é enviada para a aba 'Sem Material' e fica BLOQUEADA.", icone: "AlertTriangle" },
      { passo: 4, titulo: "4. Aplicação de Prioridade P1/P2", posto: "Painel PCP", tipo: "processo", tempo: "1 min", desc: "Pedidos 'Retira Agora' sobem para o topo da lista com sino sonoro e tarja vermelha.", icone: "Star" },
      { passo: 5, titulo: "5. Transferência de Loja", posto: "Painel PCP", tipo: "processo", tempo: "2 min", desc: "Se a fábrica local estiver sobrecarregada, transferir OP para Pinhais, Ivaiporã ou PG.", icone: "Building2" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Regra FIFO e Respeito aos Prazos de SLA",
        acaoFisica: "Os operadores nas máquinas devem produzir as OPs seguindo rigorosamente a ordem exibida de cima para baixo na tela.",
        acaoTablet: "A fila organiza as ordens calculando os dias úteis restantes para a entrega prometida ao cliente.",
        criterioQualidade: "Cumprimento de 98% dos prazos prometidos de entrega."
      },
      {
        numero: 2,
        titulo: "Gestão de OPs Sem Matéria-Prima",
        acaoFisica: "O comprador adquire o aço faltante com o fornecedor.",
        acaoTablet: "OPs com falta de aço não aparecem liberadas para o operador na máquina. Ficam retidas na aba 'Sem Material'. Quando a bobina der entrada na Expedição, o sistema apita e libera a ordem.",
        criterioQualidade: "Zero ordens fantasmas ou paradas de máquina por surpresa de estoque zerado."
      },
      {
        numero: 3,
        titulo: "Prioridade 'Retira Agora' com Senha de Gestor",
        acaoFisica: "Cliente aguarda no balcão da expedição para retirar telhas imediatamente.",
        acaoTablet: "O encarregado clica na estrela de prioridade e seleciona 'Retira Agora (P1)'. O sistema exige senha do gestor, toca alerta sonoro no tablet da máquina e coloca a ordem no topo.",
        criterioQualidade: "Agilidade com controle e registro de auditoria contra desvios de processo."
      }
    ],
    defeitos: [
      { sintoma: "Operador iniciou OP errada furando a fila", causa: "Desatenção ou falta de conferência da tarja de prioridade", solucao: "Encarregado deve orientar cumprimento estrito da ordem FIFO na tela." }
    ]
  },

  "BOBINA_COLOCAR": {
    id: "POP-BOB-01",
    titulo: "Como Colocar Bobina na Máquina (Setup Físico)",
    subtitulo: "Passo a passo completo de içamento por ponte rolante, mandril expansivo e introdução",
    setor: "Operação de Máquinas",
    setorKey: "telhas",
    maquinasCompativeis: ["TP - 40", "TP - 25", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "DESBOBINADEIRA 01", "DESBOBINADEIRA 02"],
    equipePadrao: "2 Operadores (Operador de Ponte Rolante + Operador de Máquina)",
    capacidade: "Bobinas de 3 a 15 toneladas · Larguras de 1.000mm a 1.250mm",
    corBadge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
    corHeader: "from-blue-600 to-indigo-700",
    epis: [
      { nome: "Luva Anticorte Nível 5", norma: "NR-6", desc: "Proteção obrigatória contra bordas cortantes da fita e aço" },
      { nome: "Mangote Anticorte Kevlar", norma: "NR-6", desc: "Proteção dos braços ao guiar o aço para o desbobinador" },
      { nome: "Capacete com Jugular", norma: "NR-11", desc: "Obrigatório durante todo o içamento com a ponte rolante" },
      { nome: "Botina com Bico de Aço e Metatarso", norma: "NR-6", desc: "Proteção contra prensamento de membros inferiores" }
    ],
    regrasSeguranca: [
      "Perigo Efeito Mola: NUNCA fique de frente para a ponta da bobina ao cortar a fita de arqueamento; use o braço pressor de borracha travado.",
      "Área de Carga Suspensa: Ninguém pode ficar embaixo ou no raio de giro da bobina içada pela ponte rolante.",
      "A expansão do mandril deve ser acionada até o travamento máximo de pressão mecânica/hidráulica."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Localizar Bobina", posto: "Estoque de Bobinas", tipo: "processo", tempo: "3 min", desc: "Localizar a bobina física pela etiqueta (cor, espessura e código de barras).", icone: "Search" },
      { passo: 2, titulo: "2. Içar com Ponte Rolante", posto: "Ponte Rolante", tipo: "processo", tempo: "5 min", desc: "Passar cinta de poliéster ou garra C-Hook no centro do olhal e elevar suavemente.", icone: "Crane" },
      { passo: 3, titulo: "3. Centralizar no Mandril", posto: "Desbobinador", tipo: "processo", tempo: "4 min", desc: "Encaixar no eixo do desbobinador e acionar a expansão das castanhas.", icone: "Sliders" },
      { passo: 4, titulo: "4. Trava Lateral e Pressor", posto: "Desbobinador", tipo: "inspecao", tempo: "2 min", desc: "Colocar o disco de retenção lateral e abaixar o braço pressor de borracha sobre a bobina.", icone: "ShieldCheck" },
      { passo: 5, titulo: "5. Cortar Fitas de Aço", posto: "Desbobinador", tipo: "processo", tempo: "2 min", desc: "Com tesoura industrial, cortar as cintas laterais posicionado lateralmente.", icone: "Scissors" },
      { passo: 6, titulo: "6. Guiar Ponta e Confirmar", posto: "Entrada da Perfiladeira", tipo: "finalizacao", tempo: "3 min", desc: "Avançar aço em modo pulso manual pelas réguas guia e validar bobina no tablet.", icone: "Play" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Inspeção e Içamento Seguro",
        acaoFisica: "Conferir a etiqueta física da bobina: cor, espessura real, qualidade (Galvalume, Galvanizado ou Pré-pintado) e peso. Engatar a cinta ou balancim C-Hook no olhal central da bobina. Elevar a 30 cm do chão, testar o centro de gravidade e movimentar lentamente até o desbobinador.",
        acaoTablet: "Na tela da máquina, conferir se a OP exige essa bobina antes de montar fisicamente no eixo.",
        criterioQualidade: "Içamento sem balanço, gancho com trava de segurança fechada."
      },
      {
        numero: 2,
        titulo: "Travamento do Mandril e Disco Lateral",
        acaoFisica: "Deslizar a bobina no mandril do desbobinador até o batente traseiro. Acionar a chave de expansão hidráulica (ou alavanca mecânica) até que as 4 castanhas do mandril estejam totalmente cravadas no olhal interno. Instalar o anel/disco de retenção lateral para impedir deslizamento cônico durante a rotação.",
        acaoTablet: "Nenhum comando necessário nesta etapa física.",
        criterioQualidade: "Bobina 100% rígida no eixo, sem qualquer folga radial ou axial."
      },
      {
        numero: 3,
        titulo: "Corte da Arqueação com Braço Pressor",
        acaoFisica: "Abaixar o rolo pressor pneumático de borracha com firmeza sobre a face externa da bobina. Posicionar-se na lateral (nunca na frente). Cortar as fitas de arqueamento metálicas com tesoura de chapa apropriada.",
        acaoTablet: "No tablet, abrir o modal de conferência de bobina do item.",
        criterioQualidade: "Abertura suave da ponta da bobina sem desenrolamento descontrolado."
      },
      {
        numero: 4,
        titulo: "Introdução nas Guias e Validação no Tablet",
        acaoFisica: "Acionar o desbobinador em velocidade de pulso lento para alimentar a ponta do aço entre as réguas guia de entrada da máquina. Ajustar as réguas com 1 mm de folga total.",
        acaoTablet: "Clicar no botão 'Conferir Bobina'. Validar que o código e a cor batem com a bobina instalada e confirmar o início da OP.",
        criterioQualidade: "Fita de aço perfeitamente alinhada e centrada com os primeiros roletes de conformação."
      }
    ],
    defeitos: [
      { sintoma: "Bobina patinando no eixo ao desbobinar", causa: "Mandril não foi expandido até o limite de pressão", solucao: "Parar a máquina e reapertar a expansão das castanhas com torque máximo." },
      { sintoma: "Aço entrando torto nas guias", causa: "Bobina posicionada desalinhada lateralmente no mandril", solucao: "Recuar a ponta, soltar o mandril e reposicionar alinhando com a régua guia." }
    ]
  },

  "BOBINA_ALTERAR": {
    id: "POP-BOB-02",
    titulo: "Como Alterar Bobina na OP & no Estoque",
    subtitulo: "Procedimento no sistema para troca de bobina, reajuste Odoo e devolução de saldo",
    setor: "Operação / Estoque",
    setorKey: "telhas",
    maquinasCompativeis: ["TP - 40", "TP - 25", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CORTE E DOBRA"],
    equipePadrao: "Operador de Máquina / Encarregado",
    capacidade: "Ajuste de alocação de aço, troca de fornecedor e acerto de metragem consumida",
    corBadge: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300",
    corHeader: "from-teal-600 to-cyan-700",
    epis: [
      { nome: "Luva Anticorte", norma: "NR-6", desc: "Manuseio ao retirar sobras da máquina" }
    ],
    regrasSeguranca: [
      "Nunca altere uma bobina sem antes pesar a sobra retirada na balança.",
      "Atenção à Origem: Não troque bobina 'Nacional' por 'Importada' se o pedido do cliente exigir aço Nacional."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Identificar Necessidade de Troca", posto: "Chão de Fábrica", tipo: "decisao", tempo: "1 min", desc: "Bobina na máquina acabou, está com defeito na pintura ou o cliente pediu outra cor/espessura.", icone: "AlertTriangle" },
      { passo: 2, titulo: "2. Abrir 'Conferir Bobina' na OP", posto: "Tablet da Máquina", tipo: "processo", tempo: "1 min", desc: "No card do pedido, clicar no botão de conferência de bobina do item.", icone: "Layers" },
      { passo: 3, titulo: "3. Selecionar Nova Bobina", posto: "Combobox no Tablet", tipo: "processo", tempo: "2 min", desc: "Pesquisar pelo código, cor ou espessura da bobina que foi fisicamente colocada no mandril.", icone: "Search" },
      { passo: 4, titulo: "4. Reajuste Automático Odoo", posto: "Painel da Máquina", tipo: "processo", tempo: "Instantâneo", desc: "Se houver discrepância em lote, usar o botão 'Reajuste Automático de Bobinas' para sincronizar.", icone: "RefreshCw" },
      { passo: 5, titulo: "5. Pesar Sobra Retirada", posto: "Balança Suspensa", tipo: "inspecao", tempo: "4 min", desc: "Içar a sobra retirada da máquina, pesar na balança e atualizar o peso em kg no módulo Bobinas.", icone: "Scale" },
      { passo: 6, titulo: "6. Salvar e Retomar Produção", posto: "Tablet da Máquina", tipo: "finalizacao", tempo: "1 min", desc: "Confirmar a troca. O sistema atualiza o estoque e a ordem prossegue normalmente.", icone: "CheckCircle2" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Quando Alterar a Bobina Vinculada",
        acaoFisica: "A bobina em produção chegou ao fim do rolo ou foi necessário trocar a cor/espessura para atender outra rota prioritária.",
        acaoTablet: "Na tela da máquina, localizar a OP. Clicar no botão 'Conferir Bobina' (ou no ícone de lápis/edição da OP).",
        criterioQualidade: "Bobina física e bobina no sistema devem ser 100% coincidentes para não furar o saldo contábil."
      },
      {
        numero: 2,
        titulo: "Substituição e Seleção da Nova Bobina",
        acaoFisica: "Montar a nova bobina no mandril conforme o POP-BOB-01.",
        acaoTablet: "No campo de seleção de bobina, digitar o código impresso na etiqueta da nova bobina. O sistema carrega automaticamente a espessura, cor e origem (Nacional ou Importado). Clicar em 'Confirmar e Salvar'.",
        criterioQualidade: "O sistema valida se a espessura da nova bobina atende à tolerância cadastrada da OP."
      },
      {
        numero: 3,
        titulo: "Apontamento da Sobra Retirada no Estoque",
        acaoFisica: "A bobina retirada do desbobinador (sobra com saldo) deve ser amarrada com fita e içada até a balança para apuração do peso exato restante.",
        acaoTablet: "Acessar o menu 'Estoque de Bobinas'. Localizar a bobina retirada, clicar em 'Editar' e atualizar o campo 'Peso Atual (kg)'.",
        criterioQualidade: "Saldo real no sistema perfeitamente batendo com o peso físico pesado na balança."
      }
    ],
    defeitos: [
      { sintoma: "Bobina não aparece na lista de seleção", causa: "Bobina está com saldo zerado, com status 'inativa' ou cadastrada em outra filial", solucao: "Verificar no menu 'Estoque de Bobinas' se a bobina pertence à filial ativa e se tem peso positivo." },
      { sintoma: "Alerta de origem não permitida (Nacional x Importado)", causa: "Pedido comercial exige aço Nacional e operador selecionou bobina Importada", solucao: "Selecionar obrigatoriamente uma bobina de origem Nacional para cumprir o contrato do cliente." }
    ]
  },

  "BOBINA_LANCAR": {
    id: "POP-BOB-03",
    titulo: "Como Lançar Bobina no Sistema (Telhas & C&D)",
    subtitulo: "Entrada oficial de matéria-prima, IA OCR de Nota Fiscal, cálculo de metragem e laudo usina",
    setor: "Almoxarifado / Recebimento",
    setorKey: "telhas",
    maquinasCompativeis: ["ESTOQUE BOBINAS", "CADASTRO", "NOVA BOBINA", "RECEBIMENTO", "LANCAR BOBINA"],
    equipePadrao: "Conferente de Entrada / Encarregado de Estoque",
    capacidade: "Cadastro individual e em lote (MultiplasBobinasNFCard), tolerância ±3% na pesagem",
    corBadge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
    corHeader: "from-blue-600 to-indigo-700",
    epis: [
      { nome: "Botina Bico de Aço", norma: "NR-6", desc: "Inspeção e pesagem ao lado da bobina" },
      { nome: "Luva de Vaqueta/Kevlar", norma: "NR-6", desc: "Conferência manual de rebarba e espessura" }
    ],
    regrasSeguranca: [
      "Nunca cadastrar bobina com peso estimado: O campo 'Peso Balança (kg)' deve ser preenchido com a pesagem real da balança física.",
      "Atenção à Origem: Selecionar estritamente 'Nacional' ou 'Importado' de acordo com o laudo da usina.",
      "Divergência de Peso > 3%: Se a diferença entre a NF e a balança ultrapassar 3%, segregar o rolo e alertar compras."
    ],
    fluxo: [
      { passo: 1, titulo: "1. Abertura da Janela 'Nova Bobina'", posto: "Estoque de Bobinas", tipo: "processo", tempo: "10 seg", desc: "Acessar '/bobinas' ou '/corte-dobra/bobinas' e clicar em '+ Nova Bobina'.", icone: "Plus" },
      { passo: 2, titulo: "2. Leitura com IA (OCR da NF)", posto: "Câmera / PDF", tipo: "processo", tempo: "5 seg", desc: "Tirar foto da nota de papel ou anexar PDF. A IA extrai NF, fornecedor, itens e pesos.", icone: "Camera" },
      { passo: 3, titulo: "3. Importação Individual ou Lote", posto: "Card Multi-Bobinas", tipo: "decisao", tempo: "10 seg", desc: "Se houver mais de uma bobina na NF, clicar em 'Cadastrar Todas em Lote' (gera TE0150, TE0151...).", icone: "Layers" },
      { passo: 4, titulo: "4. Conferência Chapa, Cor e Origem", posto: "Formulário", tipo: "inspecao", tempo: "30 seg", desc: "Verificar se a chapa (ex: 0,43) e a cor estão corretas. Selecionar Nacional ou Importado.", icone: "ShieldCheck" },
      { passo: 5, titulo: "5. Pesagem Real & Metragem", posto: "Balança Física", tipo: "inspecao", tempo: "1 min", desc: "Digitar o peso da balança. O sistema calcula a metragem exata: P / (L * E * 7850).", icone: "Scale" },
      { passo: 6, titulo: "6. Certificado Usina & Salvar", posto: "Tablet / Etiqueta", tipo: "finalizacao", tempo: "20 seg", desc: "Anexar PDF da usina (ou termo de ausência) e salvar. Imprimir e colar etiqueta no rolo.", icone: "CheckCircle2" }
    ],
    passosDetalhados: [
      {
        numero: 1,
        titulo: "Leitura Automática da Nota Fiscal com IA",
        acaoFisica: "Pegar o espelho impresso da NF ou o PDF encaminhado pelo fornecedor.",
        acaoTablet: "Clicar no botão '📸 Tirar Foto da NF' ou '📎 Anexar PDF'. Aguardar o processamento da IA por 3 a 5 segundos. O sistema preenche automaticamente: número da NF, fornecedor, pesos e especificações.",
        criterioQualidade: "Dados da NF capturados com precisão, reduzindo em 85% o tempo de digitação."
      },
      {
        numero: 2,
        titulo: "Cadastro em Lote (Quando a NF tem 2 ou mais bobinas)",
        acaoFisica: "Conferir quantas bobinas físicas vieram na carreta conforme a nota.",
        acaoTablet: "Ao detectar múltiplas bobinas, surge o card verde 'MultiplasBobinasNFCard'. Clicar no botão 'Cadastrar Todas em Lote'. O sistema cria toda a sequência de códigos TE#### ou CD#### instantaneamente.",
        criterioQualidade: "Geração de códigos sequenciais únicos sem risco de colisão ou esquecimento de rolos."
      },
      {
        numero: 3,
        titulo: "Uso da 'Bobina Modelo' (Preenchimento Rápido)",
        acaoFisica: "Caso esteja cadastrando manualmente sem NF digital, identificar uma bobina idêntica já existente.",
        acaoTablet: "No campo 'Bobina Modelo', pesquisar por exemplo 'Branco Pirajá 0,43'. Ao selecionar, o formulário herda automaticamente largura, chapa, qualidade e estoque mínimo.",
        criterioQualidade: "Padronização de cadastros sem inconsistências de grafia de cor ou largura."
      },
      {
        numero: 4,
        titulo: "Pesagem na Balança e Cálculo Automático da Metragem",
        acaoFisica: "Descarregar a bobina e colocá-la na balança industrial do galpão.",
        acaoTablet: "Digitar o peso no campo 'Peso Balança (kg)'. O sistema roda a fórmula física de densidade (7.850 kg/m³) e gera a metragem linear exata: Metros = Peso / (Largura * Chapa * 7850).",
        criterioQualidade: "Metragem apurada em tempo real sem necessidade de operador fazer contas manuais."
      },
      {
        numero: 5,
        titulo: "Certificado de Qualidade da Usina",
        acaoFisica: "Localizar o laudo químico e mecânico enviado pela usina (CSN, Arcelor, etc.).",
        acaoTablet: "Clicar em 'Anexar Certificado'. Se a carga chegou sem laudo físico, marcar 'Bobina sem certificado', justificando o motivo e assinando digitalmente.",
        criterioQualidade: "Rastreabilidade de conformidade mecânica exigida pelos clientes de engenharia."
      },
      {
        numero: 6,
        titulo: "Gravação & Etiquetagem",
        acaoFisica: "Anotar o código gerado (ex: TE0158) no corpo do rolo ou colar a etiqueta adesiva impressa.",
        acaoTablet: "Clicar em 'Salvar Entrada de Bobina'. O sistema grava os dados com trava anti-duplicidade e registra a auditoria com o nome do operador logado.",
        criterioQualidade: "Nenhuma bobina pode ir ao pátio sem o código TE/CD claramente legível."
      }
    ],
    defeitos: [
      { sintoma: "Alerta de Nota Fiscal já existente no sistema", causa: "A mesma NF já teve bobinas cadastradas anteriormente por outro operador", solucao: "Verificar se as bobinas da NF já não foram inseridas em lote antes de salvar novamente." },
      { sintoma: "Metragem calculada muito baixa ou zerada", causa: "Chapa ou largura digitadas com formato inválido (ex: vírgula tripla ou campo vazio)", solucao: "Verificar se a chapa está em milímetros (ex: 0,43) e a largura em 1200." },
      { sintoma: "Erro ao salvar: Código já existente", causa: "Dois operadores abriram a tela de cadastro no mesmo segundo", solucao: "O sistema regenera automaticamente o próximo código da sequência ao clicar em salvar." }
    ]
  }
};

/**
 * Retorna o POP correspondente a uma máquina ou processo
 */
export function getPopPorMaquina(maquinaNome = "") {
  if (!maquinaNome) return POPS_DATA["TP - 40"];
  const norm = String(maquinaNome).trim().toUpperCase();

  // Rotinas de PCP e Fila
  if (norm.includes("FILA")) {
    return POPS_DATA["PCP_FILA"];
  }
  if (norm.includes("PCP") || norm.includes("CENTRAL") || norm.includes("ODOO")) {
    return POPS_DATA["PCP_CENTRAL"];
  }

  // Rotinas de Bobina (Lançar vs Colocar vs Alterar)
  if (norm.includes("LANCAR") || norm.includes("LANÇAR") || norm.includes("CADASTRO") || norm.includes("NOVA BOBINA") || norm.includes("ENTRADA")) {
    return POPS_DATA["BOBINA_LANCAR"];
  }
  if (norm.includes("ALTERAR") || norm.includes("TROCAR") || norm.includes("SUBSTITUIR") || norm.includes("REAJUSTE")) {
    return POPS_DATA["BOBINA_ALTERAR"];
  }
  if (norm.includes("COLOCAR") || norm.includes("MONTAR") || norm.includes("INSTALAR") || norm.includes("IÇAR") || norm.includes("ICAR")) {
    return POPS_DATA["BOBINA_COLOCAR"];
  }
  if (norm === "BOBINA" || norm === "BOBINAS") {
    return POPS_DATA["BOBINA_COLOCAR"];
  }

  // Máquinas de Telhas
  if (norm.includes("TP") || norm.includes("40") || norm.includes("25") || norm.includes("ONDULADA") || norm.includes("COLONIAL") || norm.includes("CUMEEIRA")) {
    return POPS_DATA["TP - 40"];
  }
  if (norm.includes("COLA") || norm.includes("EPS") || norm.includes("BANDEJA")) {
    return POPS_DATA["COLAGEM"];
  }

  // Máquinas de Corte e Dobra
  if (norm.includes("DESB") && (norm.includes("02") || norm.includes("2"))) {
    return POPS_DATA["DESBOBINADEIRA 02"];
  }
  if (norm.includes("DESB")) {
    return POPS_DATA["DESBOBINADEIRA 01"];
  }
  if (norm.includes("CORTE") || norm.includes("GUILHOTINA")) {
    return POPS_DATA["GUILHOTINAS"];
  }
  if (norm.includes("DOBRA")) {
    return POPS_DATA["DOBRADEIRAS"];
  }

  // Expedição e Logística
  if (norm.includes("EXPED") || norm.includes("RECEB") || norm.includes("FRISADA")) {
    return POPS_DATA["RECEBIMENTO"];
  }
  if (norm.includes("LOGIST") || norm.includes("CARREG") || norm.includes("ROTA") || norm.includes("TIMELINE")) {
    return POPS_DATA["LOGISTICA"];
  }

  return POPS_DATA["TP - 40"];
}

