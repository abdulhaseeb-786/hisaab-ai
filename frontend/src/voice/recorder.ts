import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The microphone for "bol kar likhein".
 *
 * Records with MediaRecorder, shows a live level so the shopkeeper sees it is listening,
 * and hands back a 16 kHz mono WAV: small, and understood by Gemini, Whisper and every
 * browser's <audio> player, whatever format the phone recorded in.
 */

export type MicProblem = 'insecure' | 'unsupported' | 'denied' | 'no-mic' | 'failed' | 'too-short';
export type RecorderState = 'idle' | 'starting' | 'recording' | 'finishing';

export interface Clip {
  blob: Blob;
  seconds: number;
}

const TARGET_RATE = 16_000;
const MIN_SECONDS = 0.7;

export function micSupport(): MicProblem | null {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'unsupported';
  return null;
}

function pickMime(): string | undefined {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function toWav(blob: Blob): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
    const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), TARGET_RATE);
  } finally {
    void ctx.close();
  }
}

export function useRecorder(maxSeconds = 30) {
  const [state, setState] = useState<RecorderState>('idle');
  const [problem, setProblem] = useState<MicProblem | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const media = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number>(0);
  const startedAt = useRef(0);
  const resolver = useRef<((c: Clip | null) => void) | null>(null);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    media.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback((): Promise<Clip | null> => {
    const rec = media.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    setState('finishing');
    return new Promise<Clip | null>((resolve) => {
      resolver.current = resolve;
      rec.stop();
    });
  }, []);

  const start = useCallback(async () => {
    const unsupported = micSupport();
    if (unsupported) {
      setProblem(unsupported);
      return false;
    }
    if (media.current) return true;
    setProblem(null);
    setState('starting');
    cancelled.current = false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = s;
      const mime = pickMime();
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        const seconds = (performance.now() - startedAt.current) / 1000;
        const raw = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        cleanup();
        const done = resolver.current;
        resolver.current = null;
        if (cancelled.current) {
          setState('idle');
          done?.(null);
          return;
        }
        if (seconds < MIN_SECONDS) {
          setProblem('too-short');
          setState('idle');
          done?.(null);
          return;
        }
        let blob = raw;
        try {
          blob = await toWav(raw);
        } catch {
          /* the server also accepts the original format */
        }
        setState('idle');
        done?.({ blob, seconds });
      };

      // Live level for the listening animation.
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (t: number) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += (((data[i] ?? 128) - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        if (t - last > 60) {
          last = t;
          setLevel(Math.min(1, rms * 4));
          const sec = (performance.now() - startedAt.current) / 1000;
          setElapsed(sec);
          if (sec >= maxSeconds) void stop();
        }
        raf.current = requestAnimationFrame(tick);
      };

      media.current = rec;
      startedAt.current = performance.now();
      setElapsed(0);
      rec.start(250);
      setState('recording');
      raf.current = requestAnimationFrame(tick);
      return true;
    } catch (err) {
      cleanup();
      const name = (err as DOMException)?.name;
      setProblem(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no-mic' : 'failed');
      setState('idle');
      return false;
    }
  }, [cleanup, maxSeconds, stop]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    const rec = media.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else cleanup();
    setState('idle');
  }, [cleanup]);

  return { state, problem, level, elapsed, start, stop, cancel, clearProblem: () => setProblem(null) };
}
