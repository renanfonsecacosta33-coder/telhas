// Sound utility using Web Audio API — no external files needed.
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

// Voz que fala "Nova OP [máquina] [número]"
export function speakNovaOp(maquina, numeroOp) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const frase = `Nova ordem de produção. ${maquina || ""}. ${numeroOp ? `Número ${numeroOp}` : ""}`;
    const utter = new SpeechSynthesisUtterance(frase);
    utter.lang = "pt-BR";
    utter.rate = 1.0;
    utter.volume = 1.0;
    utter.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang?.startsWith("pt"));
    if (ptVoice) utter.voice = ptVoice;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// Voz que fala "Op finalizada [máquina] [número OP]"
export function speakOpFinalizada(maquina, numeroOp) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const frase = `Op finalizada. ${maquina || ""}. ${numeroOp ? `Número ${numeroOp}` : ""}`;
    const utter = new SpeechSynthesisUtterance(frase);
    utter.lang = "pt-BR";
    utter.rate = 1.0;
    utter.volume = 1.0;
    utter.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang?.startsWith("pt"));
    if (ptVoice) utter.voice = ptVoice;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// Som urgente (solicitação do operador para o encarregado)
export function playUrgentSound() {
  playBeep(660, 0.15, 0.35, "sawtooth");
  setTimeout(() => playBeep(880, 0.15, 0.35, "sawtooth"), 180);
  setTimeout(() => playBeep(660, 0.15, 0.35, "sawtooth"), 360);
}

// Voz que fala "Atenção, solicitação de produção pendente"
export function speakSolicitacaoPendente(maquina) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const frase = `Atenção. Solicitação de produção pendente. ${maquina || ""}`;
    const utter = new SpeechSynthesisUtterance(frase);
    utter.lang = "pt-BR";
    utter.rate = 1.0;
    utter.volume = 1.0;
    utter.pitch = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang?.startsWith("pt"));
    if (ptVoice) utter.voice = ptVoice;
    window.speechSynthesis.speak(utter);
  } catch {}
}