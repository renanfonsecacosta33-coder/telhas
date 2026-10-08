// Sound utility using Web Audio API and Speech Synthesis — no external files needed.
let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playBeep(frequency, duration, volume = 0.25, type = "sine") {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

// Som de alerta forte (nova OP criada)
export function playAlertSound() {
  playBeep(880, 0.15, 0.3, "square");
  setTimeout(() => playBeep(1100, 0.2, 0.3, "square"), 180);
}

// Som suave (OP finalizada)
export function playFinishSound() {
  playBeep(660, 0.2, 0.15, "sine");
  setTimeout(() => playBeep(880, 0.3, 0.12, "sine"), 150);
}

// Som de material disponível (OP sem material que agora tem estoque)
export function playMaterialDisponivelSound() {
  playBeep(523, 0.12, 0.3, "sine");
  setTimeout(() => playBeep(659, 0.12, 0.3, "sine"), 140);
  setTimeout(() => playBeep(784, 0.12, 0.3, "sine"), 280);
  setTimeout(() => playBeep(1047, 0.25, 0.3, "sine"), 420);
}

// Som urgente (solicitação do operador para o encarregado)
export function playUrgentSound() {
  playBeep(660, 0.15, 0.35, "sawtooth");
  setTimeout(() => playBeep(880, 0.15, 0.35, "sawtooth"), 180);
  setTimeout(() => playBeep(660, 0.15, 0.35, "sawtooth"), 360);
}

// Sirene industrial alta para chão de fábrica (alerta de ociosidade)
export function playSireneFabrica() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth"; // Som áspero e potente de sirene
    gain.gain.setValueAtTime(0.45, ctx.currentTime);

    const now = ctx.currentTime;
    // Ciclo 1 de subida e descida de sirene
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.8);
    // Ciclo 2
    osc.frequency.exponentialRampToValueAtTime(1300, now + 1.2);
    osc.frequency.exponentialRampToValueAtTime(500, now + 1.6);
    // Ciclo 3
    osc.frequency.exponentialRampToValueAtTime(1400, now + 2.0);
    osc.frequency.exponentialRampToValueAtTime(400, now + 2.4);

    gain.gain.setValueAtTime(0.45, now + 2.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2.5);
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO E GERENCIAMENTO DE VOZ DA FÁBRICA
// Suporta: "bolsonaro" (padrão com bordões 'Talkei?!'), "padrao", "desativado"
// ─────────────────────────────────────────────────────────────
export const MODO_VOZ_KEY = "ajl_modo_voz";

export function getModoVoz() {
  if (typeof window === "undefined") return "bolsonaro";
  return localStorage.getItem(MODO_VOZ_KEY) || "bolsonaro";
}

export function setModoVoz(modo) {
  if (typeof window !== "undefined") {
    localStorage.setItem(MODO_VOZ_KEY, modo);
    window.dispatchEvent(new CustomEvent("ajl_modo_voz_changed", { detail: modo }));
  }
}

/**
 * Aplica síntese de voz respeitando o modo selecionado (Bolsonaro vs Padrão).
 */
function executarFala({ frasePadrao, fraseBolsonaro, pitchBolsonaro = 0.84, rateBolsonaro = 1.04 }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const modo = getModoVoz();
  if (modo === "desativado") return;

  try {
    window.speechSynthesis.cancel();

    const ehBolsonaro = modo === "bolsonaro";
    const textoFinal = ehBolsonaro ? fraseBolsonaro : frasePadrao;
    const utter = new SpeechSynthesisUtterance(textoFinal);
    utter.lang = "pt-BR";
    utter.volume = 1.0;

    const voices = window.speechSynthesis.getVoices() || [];
    const ptVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("pt"));

    if (ehBolsonaro) {
      // Procura voz masculina brasileira em pt-BR (Daniel, Antonio, Ricardo, male, etc.)
      const vozMasculina = ptVoices.find(v =>
        /daniel|antonio|ricardo|pt-br-wavenet-b|pt-br-standard-b|male|homem/i.test(v.name)
      ) || ptVoices.find(v => !/maria|francisca|helena|female|mulher|luciana/i.test(v.name)) || ptVoices[0];

      if (vozMasculina) utter.voice = vozMasculina;
      utter.pitch = pitchBolsonaro; // Tom mais grave e rouco característico
      utter.rate = rateBolsonaro;   // Fala assertiva e rápida
    } else {
      const ptVoice = ptVoices[0];
      if (ptVoice) utter.voice = ptVoice;
      utter.pitch = 1.0;
      utter.rate = 1.0;
    }

    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn("[sounds] Erro ao executar síntese de voz:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// ANÚNCIOS DE VOZ NO CHÃO DE FÁBRICA
// ─────────────────────────────────────────────────────────────

// Voz que fala quando chega uma Nova OP
export function speakNovaOp(maquina, numeroOp) {
  const maqLimpa = String(maquina || "").replace("-", " ");
  const opLimpa = numeroOp ? String(numeroOp).replace(/^#/, "") : "";

  executarFala({
    frasePadrao: `Nova ordem de produção. ${maquina || ""}. ${opLimpa ? `Número ${opLimpa}` : ""}`,
    fraseBolsonaro: `Olha aqui, talkei?! Chegou ordem de produção nova na máquina ${maqLimpa}! ${opLimpa ? `Número ${opLimpa}.` : ""} Vamos botar pra moer, talkei?!`,
    pitchBolsonaro: 0.84,
    rateBolsonaro: 1.06
  });
}

// Voz que fala quando uma OP é finalizada
export function speakOpFinalizada(maquina, numeroOp) {
  const maqLimpa = String(maquina || "").replace("-", " ");
  const opLimpa = numeroOp ? String(numeroOp).replace(/^#/, "") : "";

  executarFala({
    frasePadrao: `Op finalizada. ${maquina || ""}. ${opLimpa ? `Número ${opLimpa}` : ""}`,
    fraseBolsonaro: `É isso daí, meus amigos! Mais uma ordem de produção finalizada com sucesso na máquina ${maqLimpa}! ${opLimpa ? `OP ${opLimpa}.` : ""} Parabéns pelo trabalho, talkei?!`,
    pitchBolsonaro: 0.83,
    rateBolsonaro: 1.04
  });
}

// Voz que fala quando material está disponível
export function speakMaterialDisponivel(maquina) {
  const maqLimpa = String(maquina || "").replace("-", " ");

  executarFala({
    frasePadrao: `Atenção. Material disponível para ordem de produção. ${maquina || ""}`,
    fraseBolsonaro: `Atenção patriota! O material já está disponível na máquina ${maqLimpa}, talkei?! Pode iniciar a produção imediatamente!`,
    pitchBolsonaro: 0.84,
    rateBolsonaro: 1.05
  });
}

// Voz de solicitação pendente do operador para o encarregado
export function speakSolicitacaoPendente(maquina) {
  const maqLimpa = String(maquina || "").replace("-", " ");

  executarFala({
    frasePadrao: `Atenção. Solicitação de produção pendente. ${maquina || ""}`,
    fraseBolsonaro: `Olha aqui meu encarregado, talkei?! Tem operador chamando na máquina ${maqLimpa}! Dá uma atenção lá ligeiro!`,
    pitchBolsonaro: 0.82,
    rateBolsonaro: 1.04
  });
}

// Voz alta alertando máquina ociosa no expediente
export function speakAlertaMaquinaOciosa(maquina, minutos = 3) {
  const maqLabel = String(maquina || "da fábrica").replace("-", " ");

  executarFala({
    frasePadrao: `Atenção operador! A máquina ${maqLabel} está parada sem produzir há mais de ${minutos} minutos! Inicie uma ordem de produção ou registre o setup imediatamente!`,
    fraseBolsonaro: `Olha aqui operador, não quero ver ninguém de braço cruzado aí não, talkei?! A máquina ${maqLabel} tá parada há mais de ${minutos} minutos! Acabou a moleza, vamos produzir, o Brasil precisa de aço!`,
    pitchBolsonaro: 0.82,
    rateBolsonaro: 1.08
  });
}

// Função de teste para ouvir a voz na hora
export function testarVoz(modoCustom = null) {
  const modo = modoCustom || getModoVoz();
  executarFala({
    frasePadrao: "Sistema de voz das telhas 100% operacional. Pronto para o trabalho.",
    fraseBolsonaro: "Olha aqui meu amigo, talkei?! A voz do Bolsonaro tá ativada com sucesso nas telhas! Vamos produzir com força total, talkei?!",
    pitchBolsonaro: 0.83,
    rateBolsonaro: 1.05
  });
}