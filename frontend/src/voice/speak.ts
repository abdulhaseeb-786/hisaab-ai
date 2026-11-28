/**
 * Read-back with the browser's own voices: nothing leaves the device.
 *
 * Urdu voices exist on most phones (Android's Google TTS) and in Edge ("Urdu (Pakistan)"),
 * but not everywhere. With an Urdu voice we read the Urdu-script sentence; in English mode
 * an English voice reads the English one. Otherwise there is no read-back and the text on
 * screen is the confirmation, which is always shown anyway.
 */

export interface Spoken {
  urdu: string;
  english: string;
}

function voices(): SpeechSynthesisVoice[] {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
}

export function urduVoice(): SpeechSynthesisVoice | undefined {
  const all = voices();
  return all.find((v) => v.lang.toLowerCase() === 'ur-pk') ?? all.find((v) => v.lang.toLowerCase().startsWith('ur'));
}

function englishVoice(): SpeechSynthesisVoice | undefined {
  const all = voices();
  return all.find((v) => v.lang === 'en-PK') ?? all.find((v) => v.lang === 'en-IN') ?? all.find((v) => v.lang.startsWith('en'));
}

/** Voices load asynchronously in Chrome; call once early so they are ready. */
export function warmUpVoices(onChange?: () => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => undefined;
  window.speechSynthesis.getVoices();
  const handler = () => onChange?.();
  window.speechSynthesis.addEventListener?.('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
}

export function canSpeak(english: boolean): boolean {
  return Boolean(urduVoice() ?? (english ? englishVoice() : undefined));
}

export function speak(text: Spoken, english: boolean): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const ur = urduVoice();
  const en = english ? englishVoice() : undefined;
  const voice = english ? en ?? ur : ur;
  if (!voice) return false;
  const u = new SpeechSynthesisUtterance(voice === ur ? text.urdu : text.english);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
