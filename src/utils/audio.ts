// Synthesized concierge bell chimes via Web Audio API & browser Chinese TTS helper

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playDeskBell(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Harmonic hotel front-desk brass bell chime (E5 + B5 overtone)
  const freqs = [659.25, 1318.5, 1975.5];
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const peak = idx === 0 ? 0.14 : idx === 1 ? 0.06 : 0.025;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  });
}

export function playWrongBuzz(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(195, now);
  osc.frequency.linearRampToValueAtTime(145, now + 0.22);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.26);
}

export function playVictoryChord(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const start = now + idx * 0.08;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.11, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.95);
  });
}

export interface TtsResult {
  supported: boolean;
  hasChineseVoice: boolean;
}

export function checkChineseTtsSupport(): TtsResult {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { supported: false, hasChineseVoice: false };
  }
  const voices = window.speechSynthesis.getVoices();
  const hasChineseVoice = voices.some((v) =>
    v.lang.toLowerCase().startsWith('zh')
  );
  return { supported: true, hasChineseVoice };
}

export function speakChinese(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onUnsupported?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onUnsupported?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.88;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice =
      voices.find((v) => v.lang.toLowerCase() === 'zh-cn') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh'));

    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => {
      onEnd?.();
      onUnsupported?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
    onUnsupported?.();
  }
}
